import { GoogleGenAI, Type } from "@google/genai";
import { Coordinates } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

interface DestinationResult {
  name: string;
  mapLink: string;
  coordinates: Coordinates;
}

interface LocationEntry {
    country: string;
    city: string; // Region/City
    district?: string; // Optional district
    name: string; // Specific POI name
    lat: number;
    lng: number;
}

// 探索主題庫 - 每次飛行隨機選擇一個主題
const THEMES = [
    "在地人推薦的必吃美食餐廳",
    "氣氛很好的隱藏版咖啡廳",
    "具有歷史意義的古蹟或老街",
    "風景優美的公園或自然景觀",
    "當地知名的購物中心或商店街",
    "有趣的博物館或藝文特區",
    "著名的宗教建築(寺廟/教堂)",
    "地標性的特色建築"
];

// 龐大的備用景點資料庫 (包含台灣各區與世界主要地標)
// 當 Gemini API 連線不穩或失敗時，會從這裡根據距離篩選合適地點
const LOCATIONS_DB: LocationEntry[] = [
    // --- 台灣 Taiwan (北部) ---
    { country: "台灣", city: "台北市", district: "信義區", name: "台北101", lat: 25.0339, lng: 121.5644 },
    { country: "台灣", city: "台北市", district: "士林區", name: "士林夜市", lat: 25.0889, lng: 121.5245 },
    { country: "台灣", city: "台北市", district: "萬華區", name: "西門町紅樓", lat: 25.0423, lng: 121.5065 },
    { country: "台灣", city: "台北市", district: "中正區", name: "中正紀念堂", lat: 25.0354, lng: 121.5197 },
    { country: "台灣", city: "台北市", district: "北投區", name: "北投溫泉博物館", lat: 25.1365, lng: 121.5063 },
    { country: "台灣", city: "新北市", district: "瑞芳區", name: "九份老街", lat: 25.1099, lng: 121.8452 },
    { country: "台灣", city: "新北市", district: "淡水區", name: "漁人碼頭", lat: 25.1828, lng: 121.4115 },
    { country: "台灣", city: "新北市", district: "板橋區", name: "新北耶誕城(市民廣場)", lat: 25.0134, lng: 121.4646 },
    { country: "台灣", city: "新北市", district: "中和區", name: "烘爐地南山福德宮", lat: 24.9706, lng: 121.5074 },
    { country: "台灣", city: "新北市", district: "平溪區", name: "十分瀑布", lat: 25.0494, lng: 121.7877 },
    { country: "台灣", city: "新北市", district: "鶯歌區", name: "鶯歌陶瓷老街", lat: 24.9546, lng: 121.3484 },
    
    // --- 台灣 Taiwan (中部) ---
    { country: "台灣", city: "台中市", district: "西屯區", name: "臺中國家歌劇院", lat: 24.1627, lng: 120.6402 },
    { country: "台灣", city: "台中市", district: "西區", name: "審計新村", lat: 24.1456, lng: 120.6625 },
    { country: "台灣", city: "台中市", district: "清水區", name: "高美濕地", lat: 24.3123, lng: 120.5484 },
    { country: "台灣", city: "南投縣", district: "魚池鄉", name: "日月潭", lat: 23.8517, lng: 120.9159 },

    // --- 台灣 Taiwan (南部) ---
    { country: "台灣", city: "台南市", district: "仁德區", name: "奇美博物館", lat: 22.9346, lng: 120.2260 },
    { country: "台灣", city: "台南市", district: "安平區", name: "安平古堡", lat: 23.0016, lng: 120.1606 },
    { country: "台灣", city: "高雄市", district: "鹽埕區", name: "駁二藝術特區", lat: 22.6204, lng: 120.2816 },
    { country: "台灣", city: "高雄市", district: "左營區", name: "蓮池潭龍虎塔", lat: 22.6806, lng: 120.2917 },
    { country: "台灣", city: "屏東縣", district: "恆春鎮", name: "鵝鑾鼻燈塔", lat: 21.9023, lng: 120.8528 },

    // --- 日本 Japan ---
    { country: "日本", city: "東京", district: "港區", name: "東京鐵塔", lat: 35.6586, lng: 139.7454 },
    { country: "日本", city: "東京", district: "台東區", name: "雷門淺草寺", lat: 35.7111, lng: 139.7967 },
    { country: "日本", city: "東京", district: "澀谷區", name: "澀谷十字路口", lat: 35.6595, lng: 139.7004 },
    { country: "日本", city: "大阪", district: "中央區", name: "道頓堀固力果跑跑人", lat: 34.6687, lng: 135.5013 },
    { country: "日本", city: "大阪", district: "此花區", name: "環球影城", lat: 34.6654, lng: 135.4323 },
    { country: "日本", city: "京都", district: "北區", name: "金閣寺", lat: 35.0394, lng: 135.7292 },
    
    // --- 韓國 Korea ---
    { country: "韓國", city: "首爾", district: "龍山區", name: "N首爾塔", lat: 37.5511, lng: 126.9882 },
    { country: "韓國", city: "首爾", district: "鐘路區", name: "景福宮", lat: 37.5796, lng: 126.9770 },
    
    // --- 其他世界 Others ---
    { country: "法國", city: "巴黎", district: "第七區", name: "艾菲爾鐵塔", lat: 48.8584, lng: 2.2945 },
    { country: "法國", city: "巴黎", district: "第一區", name: "羅浮宮", lat: 48.8606, lng: 2.3376 },
    { country: "美國", city: "紐約", district: "曼哈頓", name: "時代廣場", lat: 40.7580, lng: -73.9855 },
    { country: "美國", city: "舊金山", district: "", name: "金門大橋", lat: 37.8199, lng: -122.4783 },
    { country: "英國", city: "倫敦", district: "西敏市", name: "大笨鐘", lat: 51.5007, lng: -0.1246 },
    { country: "澳洲", city: "雪梨", district: "", name: "雪梨歌劇院", lat: -33.8568, lng: 151.2153 },
    { country: "泰國", city: "曼谷", district: "曼谷艾", name: "鄭王廟", lat: 13.7437, lng: 100.4888 },
    { country: "新加坡", city: "新加坡", district: "", name: "魚尾獅公園", lat: 1.2868, lng: 103.8545 },
    { country: "義大利", city: "羅馬", district: "", name: "羅馬競技場", lat: 41.8902, lng: 12.4922 }
];

// 輔助函式: 計算兩點間的距離 (Haversine 公式, 單位: 公尺)
const getDistance = (c1: Coordinates, c2: Coordinates): number => {
    const R = 6371e3;
    const φ1 = (c1.lat * Math.PI) / 180;
    const φ2 = (c2.lat * Math.PI) / 180;
    const Δφ = ((c2.lat - c1.lat) * Math.PI) / 180;
    const Δλ = ((c2.lng - c1.lng) * Math.PI) / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// 輔助函式: 在半徑內取得隨機經緯度座標 (作為探索中心)
const getRandomCoordinateInRadius = (center: Coordinates, radiusMeters: number): Coordinates => {
    // 隨機角度
    const angle = Math.random() * Math.PI * 2;
    // 隨機距離 (使用平方根確保分佈均勻)
    const distance = Math.sqrt(Math.random()) * radiusMeters;
    
    // 將距離轉換為經緯度差 (粗略估算: 1度緯度約 111km)
    const latOffset = (distance * Math.cos(angle)) / 111000;
    const lngOffset = (distance * Math.sin(angle)) / (111000 * Math.cos(center.lat * Math.PI / 180));
    
    return {
        lat: center.lat + latOffset,
        lng: center.lng + lngOffset
    };
};

export const findDestination = async (
  currentLocation: Coordinates,
  radiusMeters: number
): Promise<DestinationResult> => {
    
    // 1. 決定探索策略
    // 計算一個「探索中心點」，而不是直接用玩家位置
    // 這確保鳥兒會去探索圓圈內的不同區域，而不是每次都找最近的城市
    const searchCenter = getRandomCoordinateInRadius(currentLocation, radiusMeters);
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const modelId = "gemini-2.5-flash";

    console.log(`探索中心: ${searchCenter.lat.toFixed(4)}, ${searchCenter.lng.toFixed(4)} (半徑 ${radiusMeters}m 內)`);
    console.log(`本次主題: ${theme}`);

    try {
        // 使用純 Gemini 2.5 Flash 知識庫，不使用 Google Maps Tool 以提高穩定度與速度
        const prompt = `你是一位資深的旅遊嚮導與探險家。
        我目前想要探索一個座標附近的地點。
        
        【探索基準座標】
        緯度: ${searchCenter.lat}
        經度: ${searchCenter.lng}
        
        【任務指令】
        1. 請找出離這個座標最近的「城市、城鎮或熱鬧聚落」。如果座標在海上或荒野，請務必找最近有人煙的地方。
        2. 在該城鎮中，推薦一個符合主題「${theme}」的具體地點 (Point of Interest)。
        
        【嚴格要求】
        1. **地點必須真實存在**：必須是 Google Maps 上找得到的具體店名或景點名。
        2. **禁止空泛**：不要只給我「某某公園」或「市中心」，要給「大安森林公園」或「宮原眼科」。
        3. **禁止荒野**：絕對不要回傳沒有建築物的座標。
        4. **回傳格式**：請回傳嚴格的 JSON 格式。
        
        JSON 格式範例：
        {
            "country": "國家 (繁體中文)",
            "city": "縣市/主要城市 (繁體中文)",
            "district": "行政區/鄉鎮 (繁體中文)",
            "poi_name": "具體地點名稱 (繁體中文, 例如: 春水堂 人文茶館)",
            "lat": 24.1234,
            "lng": 120.5678
        }`;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                // 不使用 tools: [{ googleMaps: {} }]，避免 API 連線不穩
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        country: { type: Type.STRING },
                        city: { type: Type.STRING },
                        district: { type: Type.STRING },
                        poi_name: { type: Type.STRING },
                        lat: { type: Type.NUMBER },
                        lng: { type: Type.NUMBER }
                    }
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response text");
        const data = JSON.parse(jsonText);

        if (!data.lat || !data.lng) throw new Error("Invalid coordinates");

        // 確保回傳的地點還是在合理範圍內 (稍微放寬判定，因為 AI 找的最近城市可能稍微偏離)
        // 但基本上既然 searchCenter 是在半徑內，附近的城市通常也離玩家不遠
        
        const districtStr = data.district ? `${data.district}` : '';
        const displayName = `${data.country} - ${data.city}${districtStr} ${data.poi_name}`;
        
        // 搜尋字串優化：名稱 + 城市 + 國家
        const searchName = `${data.poi_name} ${data.city} ${data.country}`;

        return {
            name: displayName,
            // 使用網頁版 Search URL 加上 data 參數強制開啟照片模式
            mapLink: `https://www.google.com/maps/search/${encodeURIComponent(searchName)}/@${data.lat},${data.lng},17z/data=!3m1!1e2`,
            coordinates: { lat: data.lat, lng: data.lng }
        };

    } catch (error) {
        console.warn("Gemini API 探索失敗，啟動備用方案 (LOCATIONS_DB)...", error);
        
        // Fallback Logic:
        // 1. 從資料庫中篩選出「距離 <= 飛行半徑」的地點
        const candidates = LOCATIONS_DB.filter(loc => {
            const dist = getDistance(currentLocation, { lat: loc.lat, lng: loc.lng });
            return dist <= radiusMeters;
        });

        let fallbackLoc: LocationEntry;

        if (candidates.length === 0) {
            // 如果半徑內沒有內建景點，選擇最近的一個 (保底)
            const sorted = [...LOCATIONS_DB].sort((a, b) => {
                const distA = getDistance(currentLocation, { lat: a.lat, lng: a.lng });
                const distB = getDistance(currentLocation, { lat: b.lat, lng: b.lng });
                return distA - distB;
            });
            fallbackLoc = sorted[0];
        } else {
            // 從符合條件的清單中隨機挑選
            fallbackLoc = candidates[Math.floor(Math.random() * candidates.length)];
        }

        const districtStr = fallbackLoc.district ? `${fallbackLoc.district}` : '';
        const displayName = `${fallbackLoc.country} - ${fallbackLoc.city}${districtStr} ${fallbackLoc.name}`;
        const searchName = `${fallbackLoc.name} ${fallbackLoc.city} ${fallbackLoc.country}`;
        
        return {
            name: displayName,
            mapLink: `https://www.google.com/maps/search/${encodeURIComponent(searchName)}/@${fallbackLoc.lat},${fallbackLoc.lng},17z/data=!3m1!1e2`,
            coordinates: { lat: fallbackLoc.lat, lng: fallbackLoc.lng }
        };
    }
};
