#include <Arduino.h>
#include <LittleFS.h>
#define DISABLE_ALL_LIBRARY_WARNINGS 
#include <TFT_eSPI.h>

#include "makeimage.h"
#include "tag_db.h"

struct contentTypes {
    uint16_t id;
    String name;
	uint16_t tagTypes;
    void (*functionname)();
	String description;
	String optionList;
};

void contentRunner();
void drawNew(uint8_t mac[8], bool buttonPressed, tagRecord *&taginfo);
bool updateTagImage(String &filename, uint8_t *dst, uint16_t nextCheckin, imgParam &imageParams);
void drawString(TFT_eSprite &spr, String content, uint16_t posx, uint16_t posy, String font, byte align = 0, uint16_t color = TFT_BLACK);
void initSprite(TFT_eSprite &spr, int w, int h);
void drawDate(String &filename, tagRecord *&taginfo, imgParam &imageParams);
void drawNumber(String &filename, int32_t count, int32_t thresholdred, tagRecord *&taginfo, imgParam &imageParams);
void drawWeather(String &filename, JsonObject &cfgobj, tagRecord *&taginfo, imgParam &imageParams);
void drawForecast(String &filename, JsonObject &cfgobj, tagRecord *&taginfo, imgParam &imageParams);
void drawIdentify(String &filename, tagRecord *&taginfo, imgParam &imageParams);
bool getImgURL(String &filename, String URL, time_t fetched, imgParam &imageParams, String MAC);
bool getRssFeed(String &filename, String URL, String title, tagRecord *&taginfo, imgParam &imageParams);
bool getCalFeed(String &filename, String URL, String title, tagRecord *&taginfo, imgParam &imageParams);
void drawQR(String &filename, String qrcontent, String title, tagRecord *&taginfo, imgParam &imageParams);
char *formatHttpDate(time_t t);
String urlEncode(const char *msg);
int windSpeedToBeaufort(float windSpeed);
String windDirectionIcon(int degrees);
String mac62hex(uint8_t *mac);
void getLocation(JsonObject &cfgobj);
