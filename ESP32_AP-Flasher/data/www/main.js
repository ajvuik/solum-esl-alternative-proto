const $ = document.querySelector.bind(document);

const WAKEUP_REASON_TIMED = 0;
const WAKEUP_REASON_BOOT = 1;
const WAKEUP_REASON_GPIO = 2;
const WAKEUP_REASON_NFC = 3;
const WAKEUP_REASON_FIRSTBOOT = 0xFC;
const WAKEUP_REASON_NETWORK_SCAN = 0xFD;
const WAKEUP_REASON_WDT_RESET = 0xFE;

const contentModes = ["Static image", "Current date", "Counting days", "Counting hours", "Current weather", "Firmware update", "Memo text", "Image url", "Weather forecast", "RSS feed", "QR code", "Calendar", "Remote AP"];
const models = ["1.54\" 152x152px", "2.9\" 296x128px", "4.2\" 400x300px"];
models[240] = "Segmented tag"
const displaySizeLookup = { 0: [152, 152], 1: [128, 296], 2: [400, 300] };
const colorTable = { 0: [255, 255, 255], 1: [0, 0, 0], 2: [255, 0, 0], 3: [255, 0, 0] };
const contentModeOptions = [];
contentModeOptions[0] = ["filename","timetolive"];
contentModeOptions[1] = [];
contentModeOptions[2] = ["counter", "thresholdred"];
contentModeOptions[3] = ["counter", "thresholdred"];
contentModeOptions[4] = ["location"];
contentModeOptions[5] = ["filename"];
contentModeOptions[6] = ["text"];
contentModeOptions[7] = ["url","interval"];
contentModeOptions[8] = ["location"];
contentModeOptions[9] = ["title", "url", "interval"];
contentModeOptions[10] = ["title", "qr-content"];
contentModeOptions[11] = ["title", "apps_script_url", "interval"];
contentModeOptions[12] = [];

const imageQueue = [];
let isProcessing = false;
let servertimediff = 0;
let paintLoaded = false, paintShow = false;

let socket;
connect();
setInterval(updatecards, 1000);
window.addEventListener("load", function () { 
	fetch("/get_ap_list")
		.then(response => response.json())
		.then(data => {
			if (data.alias) $(".logo").innerHTML = data.alias;
		})
	loadTags(0) 
});

function loadTags(pos) {
	fetch("/get_db?pos="+pos)
		.then(response => response.json())
		.then(data => {
			processTags(data.tags);
			if (data.continu && data.continu>pos) loadTags(data.continu);
		})
		//.catch(error => showMessage('loadTags error: ' + error));
}

function connect() {
	socket = new WebSocket("ws://" + location.host + "/ws");

	socket.addEventListener("open", (event) => {
		showMessage("websocket connected");
	});

	socket.addEventListener("message", (event) => {
		console.log(event.data);
		const msg = JSON.parse(event.data);
		if (msg.logMsg) {
			showMessage(msg.logMsg,false);
		}
		if (msg.errMsg) {
			showMessage(msg.errMsg,true);
		}
		if (msg.tags) {
			processTags(msg.tags);
		}
		if (msg.sys) {
			$('#sysinfo').innerHTML = 'free heap: ' + msg.sys.heap + ' bytes &#x2507; db size: ' + msg.sys.dbsize + ' bytes &#x2507; db record count: ' + msg.sys.recordcount + ' &#x2507; littlefs free: ' + msg.sys.littlefsfree + ' bytes';
			servertimediff = (Date.now() / 1000) - msg.sys.currtime;
		}
		if (msg.apitem) {
			var row = $("#aptable").insertRow();
			row.insertCell(0).innerHTML = "<a href=\"http://" + msg.apitem.ip + "\" target=\"_new\">" + msg.apitem.ip + "</a>";
			row.insertCell(1).innerHTML = msg.apitem.alias;
			row.insertCell(2).innerHTML = msg.apitem.count;
			row.insertCell(3).innerHTML = msg.apitem.channel;
			row.insertCell(4).innerHTML = msg.apitem.version;
		}
	});

	socket.addEventListener("close", (event) => {
		showMessage(`websocket closed ${event.code}`);
		setTimeout(connect, 5000);
	});
}

function processTags(tagArray) {
	for (const element of tagArray) {
		tagmac = element.mac;

		var div = $('#tag' + tagmac);
		if (div == null) {

			div = $('#tagtemplate').cloneNode(true);
			div.setAttribute('id', 'tag'+tagmac);
			div.dataset.mac = tagmac;
			div.dataset.hwtype = -1;
			$('#taglist').appendChild(div);
		} 

		div.style.display = 'block';

		if (element.isexternal) {
			$('#tag' + tagmac + ' .mac').innerHTML = tagmac + " via ext AP";
		} else {
			$('#tag' + tagmac + ' .mac').innerHTML = tagmac;
		}
		let alias = element.alias;
		if (!alias) alias = tagmac;
		$('#tag' + tagmac + ' .alias').innerHTML = alias;

		$('#tag' + tagmac + ' .contentmode').innerHTML = contentModes[element.contentMode];
		if (element.RSSI) {
			div.dataset.hwtype = element.hwType;
			$('#tag' + tagmac + ' .model').innerHTML = models[element.hwType];
			$('#tag' + tagmac + ' .rssi').innerHTML = element.RSSI;
			$('#tag' + tagmac + ' .lqi').innerHTML = element.LQI;
			$('#tag' + tagmac + ' .temperature').innerHTML = element.temperature;
			$('#tag' + tagmac + ' .batt').innerHTML = element.batteryMv/1000;
			$('#tag' + tagmac + ' .received').style.opacity = "1";
		} else {
			$('#tag' + tagmac + ' .model').innerHTML = "waiting for hardware type";
			$('#tag' + tagmac + ' .received').style.opacity = "0";
		}

		if (div.dataset.hash != element.hash && div.dataset.hwtype > -1) {
			loadImage(tagmac, '/current/' + tagmac + '.raw?' + (new Date()).getTime());
			div.dataset.hash = element.hash;
		}

		if (element.nextupdate > 1672531200 && element.nextupdate!=3216153600) {
			var date = new Date(element.nextupdate * 1000);
			var options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
			$('#tag' + tagmac + ' .nextupdate').innerHTML = "<span>next update</span>" + date.toLocaleString('nl-NL', options);
		} else {
			$('#tag' + tagmac + ' .nextupdate').innerHTML = "";
		}

		if (element.nextcheckin > 1672531200) {
			div.dataset.nextcheckin = element.nextcheckin;
		} else {
			div.dataset.nextcheckin = element.lastseen + 1800;
		}

		div.style.opacity = '1';
		$('#tag' + tagmac + ' .lastseen').style.color = "black";
		div.classList.remove("tagpending");
		div.dataset.lastseen = element.lastseen;
		div.dataset.wakeupreason = element.wakeupReason;
		$('#tag' + tagmac + ' .warningicon').style.display = 'none';
		$('#tag' + tagmac).style.background = "inherit";
		switch (parseInt(element.wakeupReason)) {
			case WAKEUP_REASON_TIMED:
				break;
			case WAKEUP_REASON_BOOT:
				$('#tag' + tagmac + ' .nextcheckin').innerHTML = "<font color=yellow>First boot</font>"
				$('#tag' + tagmac).style.background = "#40c040";
				break;
			case WAKEUP_REASON_GPIO:
				$('#tag' + tagmac + ' .nextcheckin').innerHTML = "GPIO wakeup"
				break;
			case WAKEUP_REASON_NFC:
				$('#tag' + tagmac + ' .nextcheckin').innerHTML = "NFC wakeup"
				break;
			case WAKEUP_REASON_FIRSTBOOT:
				$('#tag' + tagmac + ' .nextcheckin').innerHTML = "<font color=yellow>First boot</font>"
				$('#tag' + tagmac).style.background = "#40c040";
				break;
			case WAKEUP_REASON_NETWORK_SCAN:
				$('#tag' + tagmac + ' .nextcheckin').innerHTML = "<font color=yellow>Network scan</font>"
				$('#tag' + tagmac).style.background = "#4040c0";
				break;
			case WAKEUP_REASON_WDT_RESET:
				$('#tag' + tagmac + ' .nextcheckin').innerHTML = "Watchdog reset!"
				$('#tag' + tagmac).style.background = "#c04040";
				break;
		}
		$('#tag' + tagmac + ' .pendingicon').style.display = (element.pending ? 'inline-block' : 'none');
		div.classList.add("tagflash");
		(function(tagmac) {
			setTimeout(function () { $('#tag' + tagmac).classList.remove("tagflash"); }, 1400);
		})(tagmac);
		if (element.pending) div.classList.add("tagpending");
	}
}

function updatecards() {
	document.querySelectorAll('[data-mac]').forEach(item => {
		let tagmac = item.dataset.mac;

		if (item.dataset.lastseen && item.dataset.lastseen > 1672531200) {
			let idletime = (Date.now() / 1000) - servertimediff - item.dataset.lastseen;
			$('#tag' + tagmac + ' .lastseen').innerHTML = "<span>last seen</span>"+displayTime(Math.floor(idletime))+" ago";
			if ((Date.now() / 1000) - servertimediff - 300 > item.dataset.nextcheckin) {
				$('#tag' + tagmac + ' .warningicon').style.display='inline-block';
				$('#tag' + tagmac).classList.remove("tagpending")
				$('#tag' + tagmac).style.background = '#ffffcc';
			}
			if (idletime > 24*3600) {
				$('#tag' + tagmac).style.opacity = '.5';
				$('#tag' + tagmac + ' .lastseen').style.color = "red";
			}
		} else {
			$('#tag' + tagmac + ' .lastseen').innerHTML = ""
		}

		if (item.dataset.nextcheckin > 1672531200 && parseInt(item.dataset.wakeupreason)==0) {
			let nextcheckin = item.dataset.nextcheckin - ((Date.now() / 1000) - servertimediff);
			$('#tag' + tagmac + ' .nextcheckin').innerHTML = "<span>expected checkin</span>" + displayTime(Math.floor(nextcheckin));
		}
	})
}

$('#clearlog').onclick = function () {
	$('#messages').innerHTML='';
}

document.querySelectorAll('.closebtn').forEach(button => {
	button.addEventListener('click', (event) => {
		event.target.parentNode.style.display = 'none';
	});
});

$('#taglist').addEventListener("click", (event) => {
	let currentElement = event.target;
	while (currentElement !== $('#taglist')) {
		if (currentElement.classList.contains("tagcard")) {
			break;
		}
		currentElement = currentElement.parentNode;
	}
	if (!currentElement.classList.contains("tagcard")) {
		return;
	}
	const mac = currentElement.dataset.mac;
	//if (event.target.classList.contains("configicon")) {
		$('#cfgmac').innerHTML = mac;
		$('#cfgmac').dataset.mac = mac;
		fetch("/get_db?mac=" + mac)
			.then(response => response.json())
			.then(data => {
				var tagdata = data.tags[0];
				$('#cfgalias').value = tagdata.alias;
				$('#cfgcontent').value = tagdata.contentMode;
				$('#cfgcontent').dataset.json = tagdata.modecfgjson;
				contentselected();
				$('#configbox').style.display = 'block';
			})
			//.catch(error => showMessage('Error: ' + error));
	//}
})

$('#cfgsave').onclick = function () {
	let contentMode = $('#cfgcontent').value;
	let extraoptions = contentModeOptions[contentMode];
	let obj={};
	if (contentMode) {
		extraoptions.forEach(element => {
			obj[element] = $('#opt' + element).value;
		});

		let formData = new FormData();
		formData.append("mac", $('#cfgmac').dataset.mac);
		formData.append("alias", $('#cfgalias').value);
		formData.append("contentmode", contentMode);
		formData.append("modecfgjson", JSON.stringify(obj));
		fetch("/save_cfg", {
			method: "POST",
			body: formData
		})
			.then(response => response.text())
			.then(data => showMessage(data))
			.catch(error => showMessage('Error: ' + error));
	}
	$('#configbox').style.display = 'none';
}

$('#cfgdelete').onclick = function () {
	let formData = new FormData();
	formData.append("mac", $('#cfgmac').dataset.mac);
	fetch("/delete_cfg", {
		method: "POST",
		body: formData
	})
		.then(response => response.text())
		.then(data => {
			var div = $('#tag' + $('#cfgmac').dataset.mac);
			div.remove();
			showMessage(data);
		})
		.catch(error => showMessage('Error: ' + error));
	$('#configbox').style.display = 'none';
}

$('#rebootbutton').onclick = function () {
	showMessage("rebooting AP....",true);
	fetch("/reboot", {
		method: "POST"
	});
	socket.close();
}

$('#apconfigbutton').onclick = function () {
	var table = document.getElementById("aptable");
	var rowCount = table.rows.length;
	for (var i = rowCount - 1; i > 0; i--) {
		table.deleteRow(i);
	}
	$('#apconfigbox').style.display = 'block'
    fetch("/get_ap_list")
        .then(response => response.json())
        .then(data => {
            $('#apcfgalias').value = data.alias;
            $('#apcfgchid').value = data.channel;
            $("#apcfgledbrightness").value = data.ledbrightness;
            $("#apcfglanguage").value = data.language;
        })
}

$('#apcfgsave').onclick = function () {
	let formData = new FormData();
	formData.append("alias", $('#apcfgalias').value);
    formData.append("channel", $('#apcfgchid').value);
    formData.append('ledbrightness', $('#apcfgledbrightness').value);
    formData.append('language', $('#apcfglanguage').value);
	fetch("/save_apcfg", {
		method: "POST",
		body: formData
	})
		.then(response => response.text())
		.then(data => showMessage(data))
		.catch(error => showMessage('Error: ' + error));
	$(".logo").innerHTML = $('#apcfgalias').value;
	$('#apconfigbox').style.display = 'none';
}

$('#paintbutton').onclick = function () {
	if (paintShow) {
		paintShow = false;
		$('#cfgsave').parentNode.style.display = 'block';
		contentselected();
	} else {
		paintShow = true;
		$('#cfgsave').parentNode.style.display = 'none';
		$('#customoptions').innerHTML = "<div id=\"buttonbar\"></div><div id=\"canvasdiv\"></div><div id=\"layersdiv\"></div><p id=\"savebar\"></p>";
		const mac = $('#cfgmac').dataset.mac
		const hwtype = $('#tag' + mac).dataset.hwtype;
		var [width, height] = displaySizeLookup[hwtype] || [0, 0];
		if (height > width) [width, height] = [height, width];
		if (paintLoaded) {
			startPainter(mac, width, height);
		} else {
			loadScript('painter.js', function () {
				startPainter(mac, width, height);
			});
		}
	}
}

function loadScript(url, callback) {
	var script = document.createElement('script');
	script.src = url;
	script.onload = function () {
		if (callback) {
			callback();
		}
	};
	document.head.appendChild(script);
}

function contentselected() {
	let contentMode = $('#cfgcontent').value;
	let extraoptions = contentModeOptions[contentMode];
	$('#customoptions').innerHTML="";
	var obj = {};
	if ($('#cfgcontent').dataset.json && ($('#cfgcontent').dataset.json!="null")) {
		obj = JSON.parse($('#cfgcontent').dataset.json);
	}
	if (contentMode) {
		$('#paintbutton').style.display = (contentMode == 0 ? 'inline-block' : 'none');
		extraoptions.forEach(element => {
			var label = document.createElement("label");
			label.innerHTML = element;
			label.setAttribute("for", 'opt' + element);
			var input = document.createElement("input");
			input.type = "text";
			input.id = 'opt' + element;
			if (obj[element]) input.value = obj[element];
			var p = document.createElement("p");
			p.appendChild(label);
			p.appendChild(input);
			$('#customoptions').appendChild(p);
		});
	}
	paintShow = false;
	$('#cfgsave').parentNode.style.display = 'block';
}

function showMessage(message,iserr) {
	const messages = $('#messages');
	var date = new Date(),
        time = date.toLocaleTimeString('nl-NL', {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'});
	if (iserr) {
		messages.insertAdjacentHTML("afterbegin", '<li class="new error">' + htmlEncode(time + ' ' + message) + '</li>');
	} else {
		messages.insertAdjacentHTML("afterbegin", '<li class="new">'+htmlEncode(time+' '+message)+'</li>');
	}
}

function htmlEncode(input) {
	const textArea = document.createElement("textarea");
	textArea.innerText = input;
	return textArea.innerHTML.split("<br>").join("\n");
}

function loadImage(id, imageSrc) {
	imageQueue.push({ id, imageSrc });
	if (!isProcessing) {
		processQueue();
	}
}

function processQueue() {
	if (imageQueue.length === 0) {
		isProcessing = false;
		return;
	}
	isProcessing = true;
	const { id, imageSrc } = imageQueue.shift();
	const canvas = $('#tag' + id + ' .tagimg');
	const hwtype = $('#tag' + id).dataset.hwtype;
	
	fetch(imageSrc)
		.then(response => response.arrayBuffer())
		.then(buffer => {
			[canvas.width, canvas.height] = displaySizeLookup[hwtype] || [0,0];
			const ctx = canvas.getContext('2d');
			const imageData = ctx.createImageData(canvas.width, canvas.height);
			const data = new Uint8ClampedArray(buffer);
			const offsetRed = (data.length >= (canvas.width * canvas.height / 8) * 2) ? canvas.width * canvas.height / 8 : 0;
			var pixelValue = 0;
			for (let i = 0; i < data.length; i++) {
				for (let j = 0; j < 8; j++) {
					const pixelIndex = i * 8 + j;
					if (offsetRed) {
						pixelValue = ((data[i] & (1 << (7 - j))) ? 1 : 0) | (((data[i + offsetRed] & (1 << (7 - j))) ? 1 : 0) << 1);
					} else {
						pixelValue = ((data[i] & (1 << (7 - j))) ? 1 : 0);
					}
					imageData.data[pixelIndex * 4] = colorTable[pixelValue][0];
					imageData.data[pixelIndex * 4 + 1] = colorTable[pixelValue][1];
					imageData.data[pixelIndex * 4 + 2] = colorTable[pixelValue][2];
					imageData.data[pixelIndex * 4 + 3] = 255;
				}
			}

			ctx.putImageData(imageData, 0, 0);
			processQueue();
		})
  		.catch (error => {
				processQueue();			
		});
}

function displayTime(seconds) {
	let hours = Math.floor(Math.abs(seconds) / 3600);
	let minutes = Math.floor((Math.abs(seconds) % 3600) / 60);
	let remainingSeconds = Math.abs(seconds) % 60;
	return (seconds < 0 ? '-' : '') + (hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}` : `${minutes}`) + `:${String(remainingSeconds).padStart(2, '0')}`;
}
