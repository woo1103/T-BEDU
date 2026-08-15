import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// 교실 프로젝터/유튜브 업로드 모두 무난한 품질
Config.setCrf(20);
Config.setChromiumOpenGlRenderer("angle");
