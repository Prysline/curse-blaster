![Curse Blaster social preview](./assets/social-preview.svg)

# curse-blaster

A tiny rage-clicking curse tracker.

「幹話發射器」是一個純前端、可直接部署到 GitHub Pages 的小型網頁 APP。點一下發射咒罵，同時依日期、時段、主題與咒罵內容累積統計。

## 功能

- 自訂咒罵字眼
- 單選或多選啟用；多選時隨機抽取
- 咒罵庫 JSON 匯入／匯出
  - 預設：合併並依文字去重
  - 可勾選：完全覆蓋目前咒罵庫
- 自訂目前咒罵主題
- 每日聚合統計，不逐次保存每個 click event
- 7 天／30 天／全部統計
- 每日點擊趨勢
- 24 小時爆氣時段
- 咒罵字眼排行
- 主題排行
- 每日／主題戰報
- 日／夜間模式
- 手機 RWD
- 統計 JSON 匯出
- 所有資料保存在瀏覽器 `localStorage`

## 專案結構

```text
curse-blaster/
├─ index.html
├─ assets/
│  ├─ favicon.svg
│  └─ social-preview.svg
├─ css/
│  ├─ style.css
│  └─ chaos.css
├─ js/
│  ├─ app.js
│  ├─ storage.js
│  └─ stats.js
├─ README.md
└─ LICENSE
```

## 資料儲存

統計採每日聚合結構，例如：

```json
{
  "dailyStats": {
    "2026-09-10": {
      "total": 37,
      "hours": {
        "14": 5,
        "15": 32
      },
      "phrases": {
        "操你媽": 25,
        "幹": 12
      },
      "topics": {
        "該死的 BUG": {
          "total": 30,
          "phrases": {
            "操你媽": 18,
            "幹": 12
          }
        }
      }
    }
  }
}
```

因此大量點擊只會增加計數，不會在 `localStorage` 中建立大量重複事件物件。

## 咒罵庫匯入格式

匯出的檔案格式：

```json
{
  "format": "curse-blaster-phrases-v1",
  "exportedAt": "2026-09-10T00:00:00.000Z",
  "phrases": [
    {
      "text": "操你媽",
      "enabled": true
    },
    {
      "text": "幹",
      "enabled": false
    }
  ]
}
```

匯入時也接受 `phrases` 直接使用純字串陣列；未勾選「完全覆蓋」時，會保留現有咒罵庫並只加入尚未存在的文字。

## 本機執行

因 JavaScript 使用 ES modules，建議透過任一靜態 HTTP server 開啟，而不是直接使用 `file://`。

例如：

```bash
python -m http.server 8000
```

接著開啟 `http://localhost:8000/`。

## GitHub Pages

在 repository 的 **Settings → Pages** 中，將來源設為從 `main` branch 的根目錄部署即可。

不需要 build step、npm 或後端服務。

## License

See [LICENSE](./LICENSE).

<a href="https://www.buymeacoffee.com/prysline"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=prysline&button_colour=fe7958&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00" /></a>
