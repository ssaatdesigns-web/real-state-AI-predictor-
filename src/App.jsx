import { useState, useEffect, useCallback } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

/* ─────────────────────────── CONSTANTS ─────────────────────────── */
const LOCATIONS = ["Kolkata", "Mumbai", "Delhi NCR", "Bengaluru", "Hyderabad", "Chennai"];
const PROP_TYPES = ["Apartment", "Villa", "Plot"];
const SEGMENTS   = ["Budget", "Mid-Range", "Premium", "Luxury"];

const BASE_PRICES = {
  Kolkata:     { Apartment: 5200,  Villa: 7800,  Plot: 3800  },
  Mumbai:      { Apartment: 18500, Villa: 32000, Plot: 14000 },
  "Delhi NCR": { Apartment: 8500,  Villa: 16000, Plot: 7200  },
  Bengaluru:   { Apartment: 7200,  Villa: 14000, Plot: 5800  },
  Hyderabad:   { Apartment: 6100,  Villa: 11500, Plot: 4700  },
  Chennai:     { Apartment: 6400,  Villa: 12000, Plot: 5100  },
};

const SEGMENT_MUL = { Budget: 0.65, "Mid-Range": 1.0, Premium: 1.55, Luxury: 2.4 };

const GROWTH = {
  Kolkata:     { Apartment:[3.2,4.1,3.8,6.2,5.8,4.4,7.1,8.3,9.2,10.1],  Villa:[2.8,3.5,4.1,5.5,6.2,5.8,8.4,9.1,10.3,11.2],  Plot:[4.1,5.2,5.8,7.1,6.4,8.2,9.8,11.2,12.5,13.8]  },
  Mumbai:      { Apartment:[5.1,3.2,-1.2,4.8,7.2,6.1,8.5,9.2,11.4,12.8], Villa:[4.2,2.8,-0.8,5.2,8.1,7.4,9.8,10.5,12.1,13.4], Plot:[6.2,4.1,1.2,6.8,9.2,8.5,11.2,12.8,14.5,15.9] },
  "Delhi NCR": { Apartment:[4.8,3.1,2.4,5.6,4.2,5.8,9.1,10.4,12.2,13.5], Villa:[3.9,2.5,1.8,4.8,5.1,6.4,10.2,11.5,13.1,14.6], Plot:[5.8,4.2,3.1,7.2,6.4,8.1,12.4,13.8,15.2,16.8] },
  Bengaluru:   { Apartment:[8.2,9.1,7.4,8.8,10.2,12.1,14.5,15.8,17.2,18.5],Villa:[7.5,8.4,6.8,9.2,11.1,13.4,15.8,17.1,18.8,20.2],Plot:[9.4,10.8,9.1,11.2,13.5,15.8,18.2,20.1,22.4,24.2] },
  Hyderabad:   { Apartment:[6.8,7.5,5.2,8.1,10.4,12.8,15.1,16.4,17.8,19.2],Villa:[5.9,6.8,4.8,7.4,9.8,12.1,14.5,15.9,17.2,18.8],Plot:[8.1,9.2,7.4,10.2,12.8,15.4,18.1,20.2,22.5,24.8] },
  Chennai:     { Apartment:[5.4,6.1,4.8,6.8,7.5,8.4,10.2,11.5,12.8,14.1], Villa:[4.8,5.5,4.1,6.2,7.1,8.8,11.1,12.4,13.8,15.2], Plot:[6.8,7.8,6.2,8.5,9.8,11.2,13.5,15.1,16.8,18.4] },
};

/* ─────────────────────────── SEEDED RNG ─────────────────────────── */
let _seed = 42;
function initSeed(s) { _seed = s; }
function rand() {
  _seed = (_seed * 1664525 + 1013904223) & 0xffffffff;
  return ((_seed >>> 0) / 0xffffffff);
}

/* ─────────────────────────── DATA MODEL ─────────────────────────── */
function genHistorical(loc, prop, seg) {
  let price = BASE_PRICES[loc][prop] * SEGMENT_MUL[seg];
  const gr   = GROWTH[loc][prop];
  return Array.from({ length: 10 }, (_, y) =>
    Array.from({ length: 4 }, (__, q) => {
      const noise = 1 + (rand() - 0.5) * 0.025;
      price = price * Math.pow(1 + gr[y] / 100, 0.25) * noise;
      return { label: `Q${q + 1} ${2015 + y}`, year: 2015 + y, quarter: q + 1, price: Math.round(price), t: y * 4 + q };
    })
  ).flat();
}

function linReg(data) {
  const n  = data.length;
  const xs = data.map(d => d.t);
  const ys = data.map(d => Math.log(d.price));
  const sx  = xs.reduce((a, b) => a + b, 0);
  const sy  = ys.reduce((a, b) => a + b, 0);
  const sx2 = xs.reduce((a, v) => a + v * v, 0);
  const sxy = xs.reduce((a, v, i) => a + v * ys[i], 0);
  const b   = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const a   = (sy - b * sx) / n;
  const yh  = xs.map(x => a + b * x);
  const ssRes = ys.reduce((s, y, i) => s + (y - yh[i]) ** 2, 0);
  const ssTot = ys.reduce((s, y) => s + (y - sy / n) ** 2, 0);
  return { a, b, r2: 1 - ssRes / ssTot, predict: t => Math.exp(a + b * t) };
}

function calcVol(data) {
  const ret = data.slice(1).map((d, i) => (d.price - data[i].price) / data[i].price);
  const m   = ret.reduce((a, b) => a + b, 0) / ret.length;
  return Math.sqrt(ret.reduce((a, v) => a + (v - m) ** 2, 0) / ret.length) * Math.sqrt(4);
}
function calcCAGR(data) { return Math.pow(data.at(-1).price / data[0].price, 0.1) - 1; }
function calcMom(data) {
  const l = data.slice(-8);
  const r = [4, 5, 6, 7].map(i => (l[i].price - l[i - 4].price) / l[i - 4].price);
  return r.reduce((a, b) => a + b, 0) / r.length;
}

function genPredictions(hist, reg) {
  const lastT = hist.at(-1).t, lastP = hist.at(-1).price;
  const vol   = calcVol(hist);
  const bl    = 0.55 * calcCAGR(hist) + 0.45 * calcMom(hist);
  return [2, 3, 5].map(yr => {
    const rP   = reg.predict(lastT + yr * 4);
    const mP   = lastP * Math.pow(1 + bl, yr);
    const pred = Math.round(0.5 * rP + 0.5 * mP);
    const cf   = vol * Math.sqrt(yr);
    return {
      years: yr, predicted: pred,
      low:   Math.round(pred * (1 - cf * 0.8)),
      high:  Math.round(pred * (1 + cf * 0.8)),
      change: (((pred - lastP) / lastP) * 100).toFixed(1),
      annualRate: (bl * 100).toFixed(1),
    };
  });
}

function buildChartData(hist, reg) {
  const lastT = hist.at(-1).t, lastP = hist.at(-1).price;
  const bl    = 0.55 * calcCAGR(hist) + 0.45 * calcMom(hist);
  const vol   = calcVol(hist);

  const histPart = hist
    .filter((_, i) => i % 2 === 0)
    .map(d => ({ label: d.label, actual: d.price, trend: Math.round(reg.predict(d.t)) }));

  const predPart = [2025, 2026, 2027, 2028, 2029, 2030].map((y, i) => {
    const t    = lastT + (i + 1) * 2;
    const pred = Math.round(0.5 * reg.predict(t) + 0.5 * lastP * Math.pow(1 + bl, (i + 1) * 0.5));
    const cf   = vol * Math.sqrt((i + 1) * 0.5);
    return { label: `${y}`, predicted: pred, low: Math.round(pred * (1 - cf * 0.8)), high: Math.round(pred * (1 + cf * 0.8)) };
  });

  return [
    ...histPart,
    { label: "Now", actual: lastP },
    ...predPart,
  ];
}

/* ─────────────────────────── FORMATTERS ─────────────────────────── */
const fmt  = n => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtK = n => n >= 1000 ? "₹" + (n / 1000).toFixed(1) + "K" : "₹" + n;

/* ─────────────────────────── TOOLTIP ─────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 14px", fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color || "#555", margin: "2px 0" }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

/* ─────────────────────────── STYLES ─────────────────────────── */
const S = {
  card:    { background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: "16px 14px" },
  muted:   { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500, marginBottom: 6 },
  statBox: { background: "#f5f5f3", borderRadius: 8, padding: "12px 10px" },
};

/* ─────────────────────────── MAIN COMPONENT ─────────────────────────── */
export default function App() {
  const [loc,     setLoc]     = useState("Kolkata");
  const [prop,    setProp]    = useState("Apartment");
  const [seg,     setSeg]     = useState("Mid-Range");
  const [hist,    setHist]    = useState([]);
  const [preds,   setPreds]   = useState([]);
  const [cData,   setCData]   = useState([]);
  const [stats,   setStats]   = useState({});
  const [tab,     setTab]     = useState("chart");
  const [aiText,  setAiText]  = useState("");
  const [aiLoad,  setAiLoad]  = useState(false);

  const recompute = useCallback(() => {
    initSeed((loc.charCodeAt(0) + prop.charCodeAt(0) + seg.charCodeAt(0)) * 137);
    const h  = genHistorical(loc, prop, seg);
    const r  = linReg(h);
    setPreds(genPredictions(h, r));
    setCData(buildChartData(h, r));
    setHist(h);
    setStats({
      cagr:   (calcCAGR(h) * 100).toFixed(1),
      vol:    (calcVol(h) * 100).toFixed(1),
      r2:     (r.r2 * 100).toFixed(1),
      curP:   h.at(-1).price,
      startP: h[0].price,
    });
    setAiText("");
  }, [loc, prop, seg]);

  useEffect(() => { recompute(); }, [recompute]);

  async function doAI() {
    setAiLoad(true); setAiText("");
    const prompt = `You are a senior real estate analyst in India. Analyze this market:
Property: ${prop} | Location: ${loc} | Segment: ${seg}
Current Price: ${fmt(stats.curP)}/sq ft | 10-Year CAGR: ${stats.cagr}% | Volatility: ${stats.vol}%
Predictions: 2yr→${fmt(preds[0]?.predicted)} (${preds[0]?.change}%), 3yr→${fmt(preds[1]?.predicted)} (${preds[1]?.change}%), 5yr→${fmt(preds[2]?.predicted)} (${preds[2]?.change}%)

Write 3 concise paragraphs: (1) current market dynamics, (2) BUY/HOLD/WAIT signal with reason, (3) key risks. Use INR values, mention local infrastructure/policy factors. Under 200 words.`;
    try {
      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      setAiText(data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "Analysis unavailable.");
    } catch {
      setAiText("Unable to fetch AI analysis. Please try again.");
    }
    setAiLoad(false);
  }

  const propIcon = { Apartment: "🏢", Villa: "🏡", Plot: "🌳" };

  const YoY = year => {
    const yr   = hist.filter(d => d.year === year);
    const prev = hist.filter(d => d.year === year - 1);
    if (!yr.length || !prev.length) return 0;
    const avg  = a => a.reduce((s, d) => s + d.price, 0) / a.length;
    return ((avg(yr) - avg(prev)) / avg(prev)) * 100;
  };

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#1a1a1a" }}>
      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Real Estate AI Price Predictor</h1>
        <p style={{ fontSize: 13, color: "#888" }}>10-year historical training · Regression + momentum model · 2 / 3 / 5-year forecasts</p>
      </div>

      {/* PROP TYPE */}
      <p style={S.muted}>Property Type</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {PROP_TYPES.map(t => (
          <button key={t} onClick={() => setProp(t)}
            style={{ padding: "8px 20px", borderRadius: 8, border: prop === t ? "2px solid #1D9E75" : "1px solid #ddd", background: prop === t ? "#E1F5EE" : "#fff", color: prop === t ? "#0F6E56" : "#555", fontWeight: prop === t ? 700 : 400, cursor: "pointer", fontSize: 14, transition: "all 0.15s" }}>
            {propIcon[t]} {t}
          </button>
        ))}
      </div>

      {/* SELECTORS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        {[["Location", LOCATIONS, loc, setLoc], ["Market Segment", SEGMENTS, seg, setSeg]].map(([label, opts, val, set]) => (
          <div key={label}>
            <p style={S.muted}>{label}</p>
            <select value={val} onChange={e => set(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, background: "#fff", color: "#1a1a1a" }}>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* STAT CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          ["Current Price / sq ft", fmt(stats.curP)],
          ["10-Year CAGR",          `${stats.cagr}%`],
          ["Volatility Index",      `${stats.vol}%`],
          ["Model Accuracy (R²)",   `${stats.r2}%`],
        ].map(([lbl, val]) => (
          <div key={lbl} style={S.statBox}>
            <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{lbl}</p>
            <p style={{ fontSize: 16, fontWeight: 700 }}>{val}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["chart", "predictions", "analysis"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "7px 18px", borderRadius: 8, border: tab === t ? "2px solid #185FA5" : "1px solid #ddd", background: tab === t ? "#E6F1FB" : "#fff", color: tab === t ? "#0C447C" : "#666", fontWeight: tab === t ? 700 : 400, cursor: "pointer", fontSize: 13, textTransform: "capitalize" }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── CHART TAB ── */}
      {tab === "chart" && (
        <div>
          <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 12, color: "#888", flexWrap: "wrap" }}>
            {[["#185FA5","Historical actual"],["#1D9E75","AI-predicted trend"],["#BA7517","Regression trendline"]].map(([col, lbl]) => (
              <span key={lbl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 20, height: 3, background: col, display: "inline-block", borderRadius: 2 }} />
                {lbl}
              </span>
            ))}
          </div>

          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#888" }} interval={4} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "#888" }} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x="Now" stroke="#aaa" strokeDasharray="4 2" label={{ value: "Now", position: "top", fontSize: 10, fill: "#aaa" }} />
                <Area type="monotone" dataKey="high"      stroke="transparent" fill="rgba(29,158,117,0.12)" dot={false} name="High band"   connectNulls activeDot={false} />
                <Area type="monotone" dataKey="low"       stroke="transparent" fill="#f9f9f7"               dot={false} name="Low band"    connectNulls activeDot={false} />
                <Line  type="monotone" dataKey="actual"    stroke="#185FA5" strokeWidth={2.5}               dot={false} name="Actual"      connectNulls />
                <Line  type="monotone" dataKey="predicted" stroke="#1D9E75" strokeWidth={2.5} strokeDasharray="6 3" dot={false} name="Predicted" connectNulls />
                <Line  type="monotone" dataKey="trend"     stroke="#BA7517" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Trend"     connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* HEATMAP */}
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Annual YoY Growth Heatmap</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 4 }}>
              {Array.from({ length: 10 }, (_, i) => 2015 + i).map(yr => {
                const chg = YoY(yr);
                return (
                  <div key={yr} style={{ textAlign: "center", background: chg >= 0 ? `rgba(29,158,117,${Math.min(chg / 20, 1) * 0.6 + 0.1})` : `rgba(216,90,48,${Math.min(Math.abs(chg) / 10, 1) * 0.6 + 0.1})`, borderRadius: 6, padding: "8px 4px" }}>
                    <p style={{ fontSize: 11, marginBottom: 3, fontWeight: 600 }}>{yr}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: chg >= 0 ? "#085041" : "#4A1B0C" }}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── PREDICTIONS TAB ── */}
      {tab === "predictions" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
            {preds.map(p => {
              const pos    = parseFloat(p.change) > 0;
              const accent = pos ? "#1D9E75" : "#D85A30";
              const bg     = pos ? "#E1F5EE" : "#FAECE7";
              const tc     = pos ? "#085041" : "#4A1B0C";
              const label  = p.years === 2 ? "2026" : p.years === 3 ? "2027" : "2029";
              return (
                <div key={p.years} style={{ ...S.card, borderTop: `3px solid ${accent}` }}>
                  <p style={{ ...S.muted, marginBottom: 6 }}>{label} — {p.years}yr</p>
                  <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{fmt(p.predicted)}</p>
                  <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>per sq ft</p>
                  <div style={{ background: bg, borderRadius: 6, padding: "5px 10px", display: "inline-block", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: tc, fontWeight: 700 }}>{pos ? "+" : ""}{p.change}% {pos ? "growth" : "decline"}</span>
                  </div>
                  <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
                    {[["Conservative", fmt(p.low), "#D85A30"], ["Base case", fmt(p.predicted), "#1a1a1a"], ["Optimistic", fmt(p.high), "#1D9E75"]].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#888" }}>{lbl}</span>
                        <span style={{ fontWeight: 700, color: col }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: "#888", marginTop: 8, borderTop: "1px solid #eee", paddingTop: 8 }}>Annual rate: {p.annualRate}%</p>
                </div>
              );
            })}
          </div>

          {/* MODEL EXPLANATION */}
          <div style={{ background: "#f5f5f3", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>How the AI model works</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12, color: "#555" }}>
              {[
                ["Exponential regression", "Fits log-linear curve over 40 quarters of data"],
                ["Momentum blending",      "55% long-term CAGR + 45% recent 2yr momentum"],
                ["Volatility scaling",     "Confidence bands widen with time horizon × vol"],
                ["Ensemble output",        "Average of regression + momentum forecasts"],
              ].map(([k, v]) => (
                <div key={k} style={{ borderLeft: "3px solid #185FA5", paddingLeft: 10 }}>
                  <p style={{ margin: "0 0 2px", fontWeight: 700, color: "#1a1a1a" }}>{k}</p>
                  <p style={{ margin: 0 }}>{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* PRICE JOURNEY */}
          <div style={{ background: "#f5f5f3", borderRadius: 10, padding: "14px 16px" }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Price journey</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, textAlign: "center" }}>
              {[
                { lbl: "2015 Start",    val: fmt(stats.startP),         col: "#888" },
                { lbl: "2024 Current",  val: fmt(stats.curP),           col: "#185FA5" },
                { lbl: "2027 Forecast", val: fmt(preds[1]?.predicted),  col: "#BA7517" },
                { lbl: "2029 Forecast", val: fmt(preds[2]?.predicted),  col: "#1D9E75" },
              ].map(s => (
                <div key={s.lbl}>
                  <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{s.lbl}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: s.col }}>{s.val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ANALYSIS TAB ── */}
      {tab === "analysis" && (
        <div>
          {/* SIGNAL CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { lbl: "Market Signal", val: parseFloat(stats.cagr) > 10 ? "Strong Buy" : parseFloat(stats.cagr) > 6 ? "Moderate Buy" : "Hold / Wait", col: parseFloat(stats.cagr) > 10 ? "#085041" : parseFloat(stats.cagr) > 6 ? "#3B6D11" : "#854F0B", bg: parseFloat(stats.cagr) > 10 ? "#E1F5EE" : parseFloat(stats.cagr) > 6 ? "#EAF3DE" : "#FAEEDA" },
              { lbl: "Risk Level",    val: parseFloat(stats.vol) > 15 ? "High" : parseFloat(stats.vol) > 8 ? "Medium" : "Low",                         col: parseFloat(stats.vol) > 15 ? "#993C1D" : parseFloat(stats.vol) > 8 ? "#854F0B" : "#085041",                               bg: parseFloat(stats.vol) > 15 ? "#FAECE7" : parseFloat(stats.vol) > 8 ? "#FAEEDA" : "#E1F5EE" },
              { lbl: "5-Year ROI",   val: `${preds[2]?.change}%`,                                                                                       col: parseFloat(preds[2]?.change) > 0 ? "#085041" : "#993C1D",                                                                   bg: parseFloat(preds[2]?.change) > 0 ? "#E1F5EE" : "#FAECE7" },
            ].map(s => (
              <div key={s.lbl} style={{ background: s.bg, borderRadius: 10, padding: 14, textAlign: "center" }}>
                <p style={{ fontSize: 11, marginBottom: 6, color: s.col, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{s.lbl}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: s.col }}>{s.val}</p>
              </div>
            ))}
          </div>

          {/* YOY HEATMAP */}
          <div style={{ background: "#f5f5f3", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>YoY Price Change Heatmap</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
              {Array.from({ length: 9 }, (_, i) => 2016 + i).map(yr => {
                const chg = YoY(yr);
                return (
                  <div key={yr} style={{ textAlign: "center", background: chg >= 0 ? `rgba(29,158,117,${Math.min(chg / 20, 1) * 0.6 + 0.1})` : `rgba(216,90,48,${Math.min(Math.abs(chg) / 10, 1) * 0.6 + 0.1})`, borderRadius: 6, padding: "8px 4px" }}>
                    <p style={{ fontSize: 11, marginBottom: 2, fontWeight: 600 }}>{yr}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: chg >= 0 ? "#085041" : "#4A1B0C" }}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI ANALYSIS */}
          <div style={{ ...S.card, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 700 }}>AI Expert Analysis</p>
              <button onClick={doAI} disabled={aiLoad}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: aiLoad ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, color: aiLoad ? "#aaa" : "#1a1a1a", opacity: aiLoad ? 0.6 : 1 }}>
                {aiLoad ? "Analyzing…" : aiText ? "Refresh ↗" : "Generate analysis ↗"}
              </button>
            </div>
            {aiLoad && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 0" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#185FA5", animation: "pulse 1.2s ease-in-out infinite" }} />
                <p style={{ fontSize: 13, color: "#888" }}>Claude is analysing {prop}s in {loc}…</p>
              </div>
            )}
            {aiText && !aiLoad && (
              <div style={{ fontSize: 14, lineHeight: 1.75, color: "#1a1a1a" }}>
                {aiText.split("\n\n").map((p, i) => <p key={i} style={{ marginBottom: "0.9rem" }}>{p}</p>)}
              </div>
            )}
            {!aiText && !aiLoad && (
              <p style={{ fontSize: 13, color: "#aaa", fontStyle: "italic" }}>
                Click "Generate analysis" to get Claude's expert market take on {prop}s in {loc}.
              </p>
            )}
          </div>

          {/* KEY METRICS */}
          <div style={{ background: "#f5f5f3", borderRadius: 10, padding: "14px 16px" }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Key metrics summary</p>
            {[
              ["Total appreciation (10 yr)", `${fmt(stats.startP)} → ${fmt(stats.curP)}`, `${(((stats.curP / stats.startP) - 1) * 100).toFixed(0)}% total`],
              ["Compound annual growth",     `${stats.cagr}%`,                            parseFloat(stats.cagr) > 8 ? "Above average" : "Moderate"],
              ["Annualized volatility",      `${stats.vol}%`,                             parseFloat(stats.vol) < 10 ? "Stable market" : "Some risk"],
              ["Model fit (R²)",             `${stats.r2}%`,                             parseFloat(stats.r2) > 90 ? "High predictability" : "Good fit"],
            ].map(([k, v, tag]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #eee" }}>
                <span style={{ color: "#555", fontSize: 13 }}>{k}</span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontWeight: 700, display: "block", fontSize: 13 }}>{v}</span>
                  <span style={{ fontSize: 11, color: "#999" }}>{tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        select:focus, button:focus { outline: 2px solid #185FA5; outline-offset: 2px; }
      `}</style>

      <p style={{ fontSize: 11, color: "#bbb", marginTop: 24, lineHeight: 1.6 }}>
        Disclaimer: Predictions are based on mock training data using exponential regression + momentum blending. Not financial advice. Real estate markets are subject to policy changes, macro factors, and local events not captured by this model.
      </p>
    </div>
  );
}
