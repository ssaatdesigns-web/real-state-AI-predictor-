import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart, Legend
} from "recharts";

const LOCATIONS = ["Kolkata", "Mumbai", "Delhi NCR", "Bengaluru", "Hyderabad", "Chennai"];
const PROP_TYPES = ["Apartment", "Villa", "Plot"];
const SEGMENTS = ["Budget", "Mid-Range", "Premium", "Luxury"];

const BASE_PRICES = {
  Kolkata:   { Apartment: 5200,  Villa: 7800,  Plot: 3800  },
  Mumbai:    { Apartment: 18500, Villa: 32000, Plot: 14000 },
  "Delhi NCR":{ Apartment: 8500, Villa: 16000, Plot: 7200  },
  Bengaluru: { Apartment: 7200,  Villa: 14000, Plot: 5800  },
  Hyderabad: { Apartment: 6100,  Villa: 11500, Plot: 4700  },
  Chennai:   { Apartment: 6400,  Villa: 12000, Plot: 5100  },
};

const SEGMENT_MULTIPLIER = { Budget: 0.65, "Mid-Range": 1.0, Premium: 1.55, Luxury: 2.4 };

const GROWTH_PROFILES = {
  Kolkata:   { Apartment: [3.2,4.1,3.8,6.2,5.8,4.4,7.1,8.3,9.2,10.1], Villa: [2.8,3.5,4.1,5.5,6.2,5.8,8.4,9.1,10.3,11.2], Plot: [4.1,5.2,5.8,7.1,6.4,8.2,9.8,11.2,12.5,13.8] },
  Mumbai:    { Apartment: [5.1,3.2,-1.2,4.8,7.2,6.1,8.5,9.2,11.4,12.8], Villa: [4.2,2.8,-0.8,5.2,8.1,7.4,9.8,10.5,12.1,13.4], Plot: [6.2,4.1,1.2,6.8,9.2,8.5,11.2,12.8,14.5,15.9] },
  "Delhi NCR":{ Apartment: [4.8,3.1,2.4,5.6,4.2,5.8,9.1,10.4,12.2,13.5], Villa: [3.9,2.5,1.8,4.8,5.1,6.4,10.2,11.5,13.1,14.6], Plot: [5.8,4.2,3.1,7.2,6.4,8.1,12.4,13.8,15.2,16.8] },
  Bengaluru: { Apartment: [8.2,9.1,7.4,8.8,10.2,12.1,14.5,15.8,17.2,18.5], Villa: [7.5,8.4,6.8,9.2,11.1,13.4,15.8,17.1,18.8,20.2], Plot: [9.4,10.8,9.1,11.2,13.5,15.8,18.2,20.1,22.4,24.2] },
  Hyderabad: { Apartment: [6.8,7.5,5.2,8.1,10.4,12.8,15.1,16.4,17.8,19.2], Villa: [5.9,6.8,4.8,7.4,9.8,12.1,14.5,15.9,17.2,18.8], Plot: [8.1,9.2,7.4,10.2,12.8,15.4,18.1,20.2,22.5,24.8] },
  Chennai:   { Apartment: [5.4,6.1,4.8,6.8,7.5,8.4,10.2,11.5,12.8,14.1], Villa: [4.8,5.5,4.1,6.2,7.1,8.8,11.1,12.4,13.8,15.2], Plot: [6.8,7.8,6.2,8.5,9.8,11.2,13.5,15.1,16.8,18.4] },
};

function generateHistoricalData(location, propType, segment) {
  const base = BASE_PRICES[location][propType] * SEGMENT_MULTIPLIER[segment];
  const growthRates = GROWTH_PROFILES[location][propType];
  const quarters = [];
  let price = base;
  const startYear = 2015;
  for (let y = 0; y < 10; y++) {
    const annualRate = growthRates[y] / 100;
    for (let q = 1; q <= 4; q++) {
      const noise = 1 + (Math.random() - 0.5) * 0.025;
      const qGrowth = Math.pow(1 + annualRate, 0.25) * noise;
      price = price * qGrowth;
      quarters.push({ label: `Q${q} ${startYear + y}`, year: startYear + y, quarter: q, price: Math.round(price), t: y * 4 + q - 1 });
    }
  }
  return quarters;
}

function polyRegression(data) {
  const n = data.length;
  const xs = data.map(d => d.t);
  const ys = data.map(d => Math.log(d.price));
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumX2 = xs.reduce((a, v) => a + v * v, 0);
  const sumXY = xs.reduce((a, v, i) => a + v * ys[i], 0);
  const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const a = (sumY - b * sumX) / n;
  const yhat = xs.map(x => a + b * x);
  const ssRes = ys.reduce((s, y, i) => s + (y - yhat[i]) ** 2, 0);
  const ssTot = ys.reduce((s, y) => s + (y - sumY / n) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;
  return { a, b, r2, predict: t => Math.exp(a + b * t) };
}

function calcVolatility(data) {
  const returns = [];
  for (let i = 1; i < data.length; i++) returns.push((data[i].price - data[i - 1].price) / data[i - 1].price);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, v) => a + (v - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(4);
}

function calcCAGR(data) {
  const n = 10;
  return Math.pow(data[data.length - 1].price / data[0].price, 1 / n) - 1;
}

function calcRecentMomentum(data) {
  const last8 = data.slice(-8);
  const yoyReturns = [];
  for (let i = 4; i < last8.length; i++) yoyReturns.push((last8[i].price - last8[i - 4].price) / last8[i - 4].price);
  return yoyReturns.reduce((a, b) => a + b, 0) / yoyReturns.length;
}

function generatePredictions(historical, reg) {
  const lastT = historical[historical.length - 1].t;
  const lastPrice = historical[historical.length - 1].price;
  const vol = calcVolatility(historical);
  const cagr = calcCAGR(historical);
  const momentum = calcRecentMomentum(historical);
  const blendedAnnual = 0.55 * cagr + 0.45 * momentum;

  const horizons = [2, 3, 5];
  return horizons.map(yr => {
    const tFuture = lastT + yr * 4;
    const regPrice = reg.predict(tFuture);
    const momentumPrice = lastPrice * Math.pow(1 + blendedAnnual, yr);
    const predicted = Math.round(0.5 * regPrice + 0.5 * momentumPrice);
    const confFactor = vol * Math.sqrt(yr);
    const low = Math.round(predicted * (1 - confFactor * 0.8));
    const high = Math.round(predicted * (1 + confFactor * 0.8));
    const change = ((predicted - lastPrice) / lastPrice) * 100;
    return { years: yr, predicted, low, high, change: change.toFixed(1), annualRate: (blendedAnnual * 100).toFixed(1) };
  });
}

function buildChartData(historical, reg) {
  const lastT = historical[historical.length - 1].t;
  const lastPrice = historical[historical.length - 1].price;
  const cagr = calcCAGR(historical);
  const momentum = calcRecentMomentum(historical);
  const blended = 0.55 * cagr + 0.45 * momentum;
  const vol = calcVolatility(historical);
  const histPart = historical.filter((_, i) => i % 2 === 0).map(d => ({
    label: d.label, actual: d.price, trend: Math.round(reg.predict(d.t))
  }));
  const predPart = [];
  const years = [2025, 2026, 2027, 2028, 2029, 2030];
  years.forEach((y, i) => {
    const t = lastT + (i + 1) * 2;
    const regP = reg.predict(t);
    const momP = lastPrice * Math.pow(1 + blended, (i + 1) * 0.5);
    const pred = Math.round(0.5 * regP + 0.5 * momP);
    const cf = vol * Math.sqrt((i + 1) * 0.5);
    predPart.push({ label: `${y}`, predicted: pred, low: Math.round(pred * (1 - cf * 0.8)), high: Math.round(pred * (1 + cf * 0.8)) });
  });
  return { histPart, predPart };
}

const fmt = n => "₹" + n.toLocaleString("en-IN");
const fmtK = n => n >= 1000 ? "₹" + (n / 1000).toFixed(1) + "K" : "₹" + n;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
      <p style={{ fontWeight: 500, marginBottom: 6, color: "var(--color-text-primary)" }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color || "var(--color-text-secondary)", margin: "2px 0" }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function RealEstatePredictor() {
  const [location, setLocation] = useState("Kolkata");
  const [propType, setPropType] = useState("Apartment");
  const [segment, setSegment] = useState("Mid-Range");
  const [historical, setHistorical] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [chartData, setChartData] = useState({ histPart: [], predPart: [] });
  const [reg, setReg] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chart");
  const [stats, setStats] = useState({});
  const seedRef = useRef(0);

  const recompute = useCallback(() => {
    Math.random = (function () {
      let seed = (location.charCodeAt(0) + propType.charCodeAt(0) + segment.charCodeAt(0)) * 137 + seedRef.current;
      return () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
    })();
    const hist = generateHistoricalData(location, propType, segment);
    const r = polyRegression(hist);
    const preds = generatePredictions(hist, r);
    const cd = buildChartData(hist, r);
    const cagr = calcCAGR(hist);
    const vol = calcVolatility(hist);
    setHistorical(hist);
    setReg(r);
    setPredictions(preds);
    setChartData(cd);
    setStats({ cagr: (cagr * 100).toFixed(1), vol: (vol * 100).toFixed(1), r2: (r.r2 * 100).toFixed(1), currentPrice: hist[hist.length - 1].price, startPrice: hist[0].price });
    setAiAnalysis("");
  }, [location, propType, segment]);

  useEffect(() => { recompute(); }, [recompute]);

  async function getAiAnalysis() {
    setAiLoading(true);
    setAiAnalysis("");
    const prompt = `You are a senior real estate analyst in India. Analyze this market data:

Property: ${propType} | Location: ${location} | Segment: ${segment}
Current Price: ${fmt(stats.currentPrice)} per sq ft
10-Year CAGR: ${stats.cagr}%
Market Volatility: ${stats.vol}%
Model Accuracy (R²): ${stats.r2}%

Predictions:
- 2 Years (2026): ${fmt(predictions[0]?.predicted)} (${predictions[0]?.change}% change)
- 3 Years (2027): ${fmt(predictions[1]?.predicted)} (${predictions[1]?.change}% change)
- 5 Years (2029): ${fmt(predictions[2]?.predicted)} (${predictions[2]?.change}% change)

Provide a concise, insightful 3-paragraph analysis covering:
1. Current market dynamics and what's driving prices in this micro-market
2. Investment thesis: Is this a BUY, HOLD, or WAIT signal? Why?
3. Key risks and what could cause the prediction to deviate significantly

Be specific, use INR values, mention local infrastructure, policy factors. Write as if advising an HNI investor. Keep it under 250 words.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "Analysis unavailable.";
      setAiAnalysis(text);
    } catch {
      setAiAnalysis("Unable to fetch AI analysis. Please try again.");
    }
    setAiLoading(false);
  }

  const trendColor = predictions[0]?.change > 0 ? "#1D9E75" : "#D85A30";
  const isPositive = predictions[0]?.change > 0;

  const allChartData = [
    ...chartData.histPart.map(d => ({ ...d, type: "historical" })),
    { label: "2024", actual: stats.currentPrice, type: "bridge" },
    ...chartData.predPart.map(d => ({ ...d, type: "predicted" })),
  ];

  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--color-text-primary)", padding: "1rem 0" }}>
      <h2 className="sr-only">Real Estate AI Price Predictor — {propType} in {location}</h2>

      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px 0", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>Property Type</p>
        <div style={{ display: "flex", gap: 8 }}>
          {PROP_TYPES.map(t => (
            <button key={t} onClick={() => setPropType(t)} style={{ padding: "8px 20px", borderRadius: 8, border: propType === t ? "2px solid #1D9E75" : "0.5px solid var(--color-border-tertiary)", background: propType === t ? "#E1F5EE" : "var(--color-background-primary)", color: propType === t ? "#0F6E56" : "var(--color-text-secondary)", fontWeight: propType === t ? 500 : 400, cursor: "pointer", fontSize: 14, transition: "all 0.15s" }}>
              {t === "Apartment" ? "🏢" : t === "Villa" ? "🏡" : "🌳"} {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1.5rem" }}>
        <div>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 8px 0", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>Location</p>
          <select value={location} onChange={e => setLocation(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 14 }}>
            {LOCATIONS.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 8px 0", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>Market Segment</p>
          <select value={segment} onChange={e => setSegment(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 14 }}>
            {SEGMENTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: "1.5rem" }}>
        {[
          { label: "Current Price / sq ft", value: fmt(stats.currentPrice) },
          { label: "10-Year CAGR", value: `${stats.cagr}%` },
          { label: "Volatility Index", value: `${stats.vol}%` },
          { label: "Model Accuracy (R²)", value: `${stats.r2}%` },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "12px 14px" }}>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 4px 0" }}>{s.label}</p>
            <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
        {["chart", "predictions", "analysis"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: "7px 18px", borderRadius: 8, border: activeTab === t ? "2px solid #185FA5" : "0.5px solid var(--color-border-tertiary)", background: activeTab === t ? "#E6F1FB" : "var(--color-background-primary)", color: activeTab === t ? "#0C447C" : "var(--color-text-secondary)", fontWeight: activeTab === t ? 500 : 400, cursor: "pointer", fontSize: 13, textTransform: "capitalize" }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === "chart" && (
        <div>
          <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12, color: "var(--color-text-secondary)", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 24, height: 3, background: "#185FA5", display: "inline-block", borderRadius: 2 }}></span>Historical actual</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 24, height: 3, background: "#1D9E75", display: "inline-block", borderRadius: 2 }}></span>AI-predicted trend</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 20, height: 12, background: "rgba(29,158,117,0.15)", display: "inline-block", borderRadius: 2 }}></span>Confidence band</span>
          </div>
          <div style={{ position: "relative", width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={allChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#185FA5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#185FA5" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1D9E75" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} interval={3} />
                <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x="2024" stroke="#888" strokeDasharray="4 2" label={{ value: "Now", position: "top", fontSize: 11, fill: "#888" }} />
                <Area type="monotone" dataKey="actual" stroke="#185FA5" strokeWidth={2.5} fill="url(#histGrad)" dot={false} name="Actual" connectNulls />
                <Area type="monotone" dataKey="high" stroke="transparent" fill="url(#predGrad)" dot={false} name="High" connectNulls />
                <Area type="monotone" dataKey="low" stroke="transparent" fill="var(--color-background-primary)" dot={false} name="Low" connectNulls />
                <Line type="monotone" dataKey="predicted" stroke="#1D9E75" strokeWidth={2.5} strokeDasharray="6 3" dot={false} name="Predicted" connectNulls />
                <Line type="monotone" dataKey="trend" stroke="#BA7517" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Regression trend" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Quarterly Price History (Last 10 Years)</p>
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4, minWidth: 600 }}>
                {historical.filter(d => d.quarter === 1).map((d, i) => {
                  const yearData = historical.filter(h => h.year === d.year);
                  const avgPrice = yearData.reduce((s, h) => s + h.price, 0) / yearData.length;
                  const prevYear = historical.filter(h => h.year === d.year - 1);
                  const prevAvg = prevYear.length ? prevYear.reduce((s, h) => s + h.price, 0) / prevYear.length : avgPrice;
                  const yoy = ((avgPrice - prevAvg) / prevAvg) * 100;
                  const maxChange = 25;
                  const intensity = Math.min(Math.abs(yoy) / maxChange, 1);
                  const bg = yoy >= 0 ? `rgba(29,158,117,${0.1 + intensity * 0.5})` : `rgba(216,90,48,${0.1 + intensity * 0.5})`;
                  return (
                    <div key={d.year} style={{ background: bg, borderRadius: 6, padding: "10px 8px", textAlign: "center" }}>
                      <p style={{ fontSize: 12, fontWeight: 500, margin: "0 0 4px 0" }}>{d.year}</p>
                      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 4px 0" }}>{fmtK(Math.round(avgPrice))}</p>
                      <p style={{ fontSize: 11, color: yoy >= 0 ? "#0F6E56" : "#993C1D", margin: 0, fontWeight: 500 }}>{yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "predictions" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: "1.5rem" }}>
            {predictions.map(p => {
              const pos = parseFloat(p.change) > 0;
              const accent = pos ? "#1D9E75" : "#D85A30";
              const bg = pos ? "#E1F5EE" : "#FAECE7";
              const textCol = pos ? "#085041" : "#4A1B0C";
              return (
                <div key={p.years} style={{ background: "var(--color-background-primary)", border: `0.5px solid var(--color-border-tertiary)`, borderRadius: 12, padding: "1.25rem", borderTop: `3px solid ${accent}` }}>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 6px 0", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>
                    {p.years === 2 ? "2026" : p.years === 3 ? "2027" : "2029"} — {p.years} Year{p.years > 1 ? "s" : ""}
                  </p>
                  <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 8px 0" }}>{fmt(p.predicted)}</p>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px 0" }}>per sq ft</p>
                  <div style={{ background: bg, borderRadius: 6, padding: "6px 10px", display: "inline-block", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: textCol, fontWeight: 500 }}>{pos ? "+" : ""}{p.change}% {pos ? "growth" : "decline"}</span>
                  </div>
                  <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10, marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--color-text-secondary)" }}>Conservative</span>
                      <span style={{ color: "#D85A30", fontWeight: 500 }}>{fmt(p.low)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--color-text-secondary)" }}>Base case</span>
                      <span style={{ fontWeight: 500 }}>{fmt(p.predicted)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--color-text-secondary)" }}>Optimistic</span>
                      <span style={{ color: "#1D9E75", fontWeight: 500 }}>{fmt(p.high)}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
                    <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>Blended Annual Rate: <strong>{p.annualRate}%</strong></p>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1rem" }}>
            <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 10px 0" }}>How the model works</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
              {[
                ["Exponential regression", "Fits log-linear trend over 40 quarters of data"],
                ["Momentum blending", "55% long-term CAGR + 45% recent 2-year momentum"],
                ["Volatility scaling", "Confidence bands widen with time horizon × annualized vol"],
                ["Ensemble output", "Average of regression forecast and momentum forecast"],
              ].map(([k, v]) => (
                <div key={k} style={{ borderLeft: "2px solid #185FA5", paddingLeft: 10 }}>
                  <p style={{ margin: "0 0 2px 0", fontWeight: 500, color: "var(--color-text-primary)" }}>{k}</p>
                  <p style={{ margin: 0 }}>{v}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem 1.25rem" }}>
            <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 10px 0" }}>Price Journey Summary</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { label: "2015 Base", value: fmt(stats.startPrice), color: "var(--color-text-primary)" },
                { label: "Current (2024)", value: fmt(stats.currentPrice), color: "#185FA5" },
                { label: "2027 Forecast", value: fmt(predictions[1]?.predicted), color: "#BA7517" },
                { label: "2029 Forecast", value: fmt(predictions[2]?.predicted), color: "#1D9E75" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 4px 0" }}>{s.label}</p>
                  <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, height: 6, borderRadius: 6, background: "var(--color-border-tertiary)", position: "relative", overflow: "visible" }}>
              {[0, 33, 55, 100].map((pct, i) => (
                <div key={i} style={{ position: "absolute", left: `${pct}%`, top: "50%", transform: "translate(-50%,-50%)", width: i === 0 ? 8 : 10, height: i === 0 ? 8 : 10, borderRadius: "50%", background: ["var(--color-text-tertiary)", "#185FA5", "#BA7517", "#1D9E75"][i], border: "2px solid var(--color-background-primary)" }} />
              ))}
              <div style={{ height: "100%", background: `linear-gradient(to right, #185FA5, #1D9E75)`, borderRadius: 6, width: "55%" }} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "analysis" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: "1.25rem" }}>
            {[
              { label: "Market Signal", value: parseFloat(stats.cagr) > 10 ? "Strong Buy" : parseFloat(stats.cagr) > 6 ? "Moderate Buy" : "Hold/Wait", color: parseFloat(stats.cagr) > 10 ? "#0F6E56" : parseFloat(stats.cagr) > 6 ? "#3B6D11" : "#854F0B", bg: parseFloat(stats.cagr) > 10 ? "#E1F5EE" : parseFloat(stats.cagr) > 6 ? "#EAF3DE" : "#FAEEDA" },
              { label: "Risk Level", value: parseFloat(stats.vol) > 15 ? "High" : parseFloat(stats.vol) > 8 ? "Medium" : "Low", color: parseFloat(stats.vol) > 15 ? "#993C1D" : parseFloat(stats.vol) > 8 ? "#854F0B" : "#0F6E56", bg: parseFloat(stats.vol) > 15 ? "#FAECE7" : parseFloat(stats.vol) > 8 ? "#FAEEDA" : "#E1F5EE" },
              { label: "5-Year ROI Est.", value: `${predictions[2]?.change}%`, color: parseFloat(predictions[2]?.change) > 0 ? "#0F6E56" : "#993C1D", bg: parseFloat(predictions[2]?.change) > 0 ? "#E1F5EE" : "#FAECE7" },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "14px", textAlign: "center" }}>
                <p style={{ fontSize: 11, margin: "0 0 6px 0", color: s.color, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: 18, fontWeight: 500, margin: 0, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
            <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary)" }}>Price Volatility by Year (Heatmap)</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {historical.filter(d => d.quarter === 1).slice(1).map((d, i) => {
                const prev = historical.filter(h => h.year === d.year - 1);
                const curr = historical.filter(h => h.year === d.year);
                const pa = prev.reduce((s, h) => s + h.price, 0) / prev.length;
                const ca = curr.reduce((s, h) => s + h.price, 0) / curr.length;
                const chg = ((ca - pa) / pa) * 100;
                return (
                  <div key={d.year} style={{ textAlign: "center", background: chg > 0 ? `rgba(29,158,117,${Math.min(chg / 20, 1) * 0.6 + 0.1})` : `rgba(216,90,48,${Math.min(Math.abs(chg) / 10, 1) * 0.6 + 0.1})`, borderRadius: 6, padding: "8px 4px" }}>
                    <p style={{ fontSize: 11, margin: "0 0 2px 0", fontWeight: 500 }}>{d.year}</p>
                    <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: chg >= 0 ? "#085041" : "#4A1B0C" }}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "1.25rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>AI Market Analysis</p>
              <button onClick={getAiAnalysis} disabled={aiLoading} style={{ padding: "8px 16px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", cursor: aiLoading ? "not-allowed" : "pointer", fontSize: 13, color: aiLoading ? "var(--color-text-tertiary)" : "var(--color-text-primary)" }}>
                {aiLoading ? "Analyzing..." : aiAnalysis ? "Refresh analysis ↗" : "Generate AI analysis ↗"}
              </button>
            </div>
            {aiLoading && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "1rem 0" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#185FA5", animation: "pulse 1s ease-in-out infinite" }} />
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Claude is analyzing market data for {propType}s in {location}...</p>
              </div>
            )}
            {aiAnalysis && !aiLoading && (
              <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-text-primary)" }}>
                {aiAnalysis.split("\n\n").map((para, i) => (
                  <p key={i} style={{ margin: "0 0 1rem 0" }}>{para}</p>
                ))}
              </div>
            )}
            {!aiAnalysis && !aiLoading && (
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0, fontStyle: "italic" }}>Click "Generate AI analysis" to get Claude's expert take on this market.</p>
            )}
          </div>

          <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem 1.25rem" }}>
            <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 10px 0" }}>Key metrics at a glance</p>
            <div style={{ fontSize: 13, display: "grid", gap: 8 }}>
              {[
                ["Price appreciation (10 yr)", `${fmt(stats.startPrice)} → ${fmt(stats.currentPrice)}`, `${(((stats.currentPrice / stats.startPrice) - 1) * 100).toFixed(0)}% total`],
                ["Compound annual growth", `${stats.cagr}%`, stats.cagr > 8 ? "Above average" : "Moderate"],
                ["Annualized volatility", `${stats.vol}%`, stats.vol < 10 ? "Stable market" : "Moderate risk"],
                ["Model fit (R²)", `${stats.r2}%`, stats.r2 > 90 ? "High predictability" : "Moderate noise"],
              ].map(([k, v, tag]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>{k}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontWeight: 500, display: "block" }}>{v}</span>
                    <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: "1.5rem", lineHeight: 1.6 }}>
        Disclaimer: Predictions are generated using exponential regression and momentum blending on mock historical data. Not financial advice. Real estate markets are subject to policy changes, macroeconomic shifts, and local factors not captured by this model.
      </p>
    </div>
  );
}
