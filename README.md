# 🏠 Real Estate AI Price Predictor

An AI-powered real estate price prediction web app for the Indian market. Built with React, Vite, Recharts, and the Anthropic Claude API. Predicts whether property prices will rise or fall over the next **2, 3, and 5 years** based on 10 years of historical price data.

---

## ✨ Features

- 📊 **10-year historical price chart** with quarterly data across 6 Indian cities
- 🤖 **AI prediction model** using exponential regression + momentum blending
- 📈 **2 / 3 / 5-year price forecasts** with conservative, base, and optimistic ranges
- 🌡️ **Annual YoY growth heatmap** showing market cycles at a glance
- 💬 **Claude AI expert analysis** — live market commentary with BUY / HOLD / WAIT signal
- 🏢 Supports **Apartments, Villas, and Plots** across **Budget, Mid-Range, Premium, and Luxury** segments
- 🏙️ Covers **Kolkata, Mumbai, Delhi NCR, Bengaluru, Hyderabad, and Chennai**

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 |
| Build tool | Vite 5 |
| Charts | Recharts |
| AI analysis | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Deployment | Vercel |
| Styling | Inline CSS (no external UI library) |

---

## 📁 Project Structure

```
real-estate-predictor/
├── index.html          # Vite HTML entry point
├── package.json        # Dependencies and scripts
├── vite.config.js      # Vite + React plugin config
├── vercel.json         # SPA routing config for Vercel
├── .gitignore
└── src/
    ├── main.jsx        # ReactDOM root mount
    └── App.jsx         # Main application component
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/real-state-AI.git
cd real-state-AI

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

The output will be in the `dist/` folder.

---

## ☁️ Deploying to Vercel

### Option 1 — Vercel Dashboard (recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repository
4. Set the following in project settings:

| Setting | Value |
|---|---|
| Framework Preset | **Vite** |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

5. Click **Deploy** — your app will be live in ~60 seconds

### Option 2 — Vercel CLI

```bash
npm install -g vercel
vercel
```

---

## 🧠 How the AI Model Works

The prediction engine uses a three-step approach:

### 1. Exponential Regression
Fits a log-linear curve across 40 quarters (10 years) of historical price data. Computes the slope, intercept, and R² (goodness-of-fit score) to measure how well the trend line matches real prices.

```
log(price) = a + b × time
```

### 2. Momentum Blending
Blends two signals for a more responsive and accurate forecast:
- **55%** long-term CAGR (compound annual growth rate over 10 years)
- **45%** recent momentum (YoY growth over the last 2 years)

### 3. Confidence Bands
Uncertainty grows with the forecast horizon. Confidence intervals are scaled by:
```
band = predicted × (volatility × √years × 0.8)
```
So a 5-year forecast has a wider band than a 2-year forecast, correctly reflecting increasing uncertainty.

### 4. Ensemble Output
The final predicted price is the average of the regression forecast and the momentum forecast, giving a balanced view of long-term trend and recent market behavior.

---

## 📊 Mock Training Data

The app uses realistic mock data modelled on Indian real estate market behavior:

- **6 cities**: Kolkata, Mumbai, Delhi NCR, Bengaluru, Hyderabad, Chennai
- **3 property types**: Apartment, Villa, Plot
- **4 market segments**: Budget, Mid-Range, Premium, Luxury
- **40 quarters** of price history (Q1 2015 → Q4 2024)
- City-specific growth profiles (e.g. Bengaluru tech-boom acceleration, Mumbai 2017 dip)
- Slight random noise per quarter using a seeded RNG for reproducibility

---

## 🔑 Claude API Integration

The "AI Expert Analysis" feature calls the Anthropic Claude API directly from the browser. When the user clicks **Generate analysis**, the app sends the current market stats and predictions to Claude and receives a 3-paragraph expert report covering:

1. Current market dynamics
2. BUY / HOLD / WAIT investment signal
3. Key risks that could cause the forecast to deviate

> **Note:** The Anthropic API key is handled by the Claude.ai infrastructure when running inside the Claude chat environment. For standalone deployment, you will need to add your own API key (see below).

### Adding Your Own API Key (for standalone deployment)

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Create a `.env` file in the project root:

```env
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

3. Update the fetch call in `src/App.jsx`:

```js
headers: {
  "Content-Type": "application/json",
  "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
},
```

> ⚠️ For production apps, never expose API keys in the browser. Route API calls through a backend or a Vercel serverless function instead.

---

## 📸 App Screenshots

| Tab | Description |
|---|---|
| **Chart** | Historical price curve + predicted extension + confidence band + heatmap |
| **Predictions** | Cards for 2026, 2027, 2029 with low / base / high scenarios |
| **Analysis** | Signal rating, risk level, YoY heatmap, and live Claude AI commentary |

---

## ⚠️ Disclaimer

Predictions are generated using mock historical data and a statistical model. This application is for **educational and demonstration purposes only** and does not constitute financial or investment advice. Real estate markets are subject to policy changes, macroeconomic shifts, infrastructure developments, and local factors not captured by this model. Always consult a qualified financial advisor before making investment decisions.

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙌 Built With

- [React](https://react.dev)
- [Vite](https://vitejs.dev)
- [Recharts](https://recharts.org)
- [Anthropic Claude](https://anthropic.com)
- [Vercel](https://vercel.com)
