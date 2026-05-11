import { useState, useEffect, useRef } from "react";

// ── Supabase config — drop your keys here when ready ─────────────────────────
const SUPABASE_URL  = "YOUR_SUPABASE_URL";
const SUPABASE_ANON = "YOUR_SUPABASE_ANON_KEY";
const supabaseReady = !SUPABASE_URL.startsWith("YOUR");

const sbInsert = async (table, row) => {
  if (!supabaseReady) return { error: "Supabase not configured" };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${SUPABASE_ANON}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(row),
  });
  return res.ok ? { error: null } : { error: await res.text() };
};

// ── Rate limit — max 1 submission per email per 60s client-side ──────────────
const canSubmit = (email) => {
  const key = `pm_last_${email}`;
  const last = parseInt(localStorage.getItem(key) || "0");
  if (Date.now() - last < 60000) return false;
  localStorage.setItem(key, Date.now());
  return true;
};

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ── Utility ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));

const fmtCr = (n) => {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  return fmt(n);
};

const rupee = (n) => `\u20B9${fmtCr(n)}`;

// ── Slider with tap-to-type ───────────────────────────────────────────────────
function Slider({ label, value, min, max, step, onChange, display }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const startEdit = () => { setInputVal(String(value)); setEditing(true); };
  const commit = () => {
    const num = parseFloat(String(inputVal).replace(/,/g, ""));
    if (!isNaN(num)) onChange(Math.min(max, Math.max(min, Math.round(num / step) * step)));
    setEditing(false);
  };
  const onKey = (e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(false); };

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: "#94a3b8", fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>{label}</span>
        {editing ? (
          <input autoFocus type="number" value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={commit} onKeyDown={onKey}
            style={{
              background: "#0f172a", border: "2px solid #00d09c", color: "#00d09c",
              padding: "3px 10px", borderRadius: 20, fontSize: 13, fontWeight: 700,
              fontFamily: "DM Sans, sans-serif", width: 140, textAlign: "right", outline: "none"
            }}
          />
        ) : (
          <span onClick={startEdit} style={{
            background: "linear-gradient(135deg, #00d09c, #00b386)", color: "#fff",
            padding: "3px 10px 3px 13px", borderRadius: 20, fontSize: 13, fontWeight: 700,
            fontFamily: "DM Sans, sans-serif", cursor: "pointer", userSelect: "none",
            display: "flex", alignItems: "center", gap: 5
          }}>
            {display}<span style={{ fontSize: 10 }}>✏</span>
          </span>
        )}
      </div>
      <div style={{ position: "relative", height: 6 }}>
        <div style={{ position: "absolute", inset: 0, background: "#1e293b", borderRadius: 10 }} />
        <div style={{
          position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct}%`,
          background: "linear-gradient(90deg, #00d09c, #00b386)", borderRadius: 10, transition: "width 0.12s"
        }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: "absolute", top: -6, left: 0, width: "100%", opacity: 0, cursor: "pointer", height: 18, margin: 0 }}
        />
        <div style={{
          position: "absolute", left: `calc(${pct}% - 8px)`, top: -5,
          width: 16, height: 16, background: "#00d09c", borderRadius: "50%",
          border: "3px solid #0f172a", boxShadow: "0 0 0 3px rgba(0,208,156,0.25)",
          transition: "left 0.12s", pointerEvents: "none"
        }} />
      </div>
    </div>
  );
}

// ── Result Card (adaptive font size) ─────────────────────────────────────────
function ResultCard({ label, value, accent }) {
  const len = String(value).length;
  const fs = accent
    ? (len > 13 ? 13 : len > 11 ? 15 : len > 8 ? 18 : 22)
    : (len > 13 ? 11 : len > 11 ? 13 : len > 8 ? 15 : 18);
  return (
    <div style={{
      background: accent ? "linear-gradient(135deg, #00d09c22, #00b38611)" : "#1e293b",
      border: `1px solid ${accent ? "#00d09c44" : "#334155"}`,
      borderRadius: 14, padding: "14px 8px", textAlign: "center", overflow: "hidden"
    }}>
      <div style={{ color: "#64748b", fontSize: 10, marginBottom: 5, fontFamily: "DM Sans, sans-serif", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
      <div style={{ color: accent ? "#00d09c" : "#f1f5f9", fontSize: fs, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────────────
function Donut({ a, b, labelA = "#00d09c", labelB = "#f97316" }) {
  const total = a + b, r = 50, cx = 70, cy = 70, circ = 2 * Math.PI * r, gap = 2;
  const aDash = (a / total) * circ, bDash = (b / total) * circ;
  const totalStr = rupee(total);
  const fs = totalStr.length > 10 ? 9 : 11;
  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={16} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={labelA} strokeWidth={16}
        strokeDasharray={`${aDash - gap} ${circ - aDash + gap}`}
        strokeDashoffset={circ / 4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={labelB} strokeWidth={16}
        strokeDasharray={`${bDash - gap} ${circ - bDash + gap}`}
        strokeDashoffset={circ / 4 - aDash + gap} strokeLinecap="round" />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="DM Sans, sans-serif">Total</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#e2e8f0" fontSize={fs} fontWeight={700} fontFamily="DM Sans, sans-serif">{totalStr}</text>
    </svg>
  );
}

// ── Growth Bar ────────────────────────────────────────────────────────────────
function GrowthBar({ invested, returns }) {
  const total = invested + returns;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", height: 12 }}>
        <div style={{ width: `${(invested / total) * 100}%`, background: "#3b82f6", transition: "width 0.4s" }} />
        <div style={{ width: `${(returns / total) * 100}%`, background: "#00d09c", transition: "width 0.4s" }} />
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        {[["#3b82f6", "Invested"], ["#00d09c", "Returns"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
            <span style={{ color: "#94a3b8", fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stat Row ──────────────────────────────────────────────────────────────────
function StatRow({ label, value, color = "#00d09c" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", marginTop: 10 }}>
      <span style={{ color: "#64748b", fontSize: 12, fontFamily: "DM Sans, sans-serif" }}>{label}</span>
      <span style={{ color, fontWeight: 700, fontSize: 13, fontFamily: "Syne, sans-serif" }}>{value}</span>
    </div>
  );
}

// ── EMI ───────────────────────────────────────────────────────────────────────
function EMICalc() {
  const [loan, setLoan] = useState(5000000);
  const [rate, setRate] = useState(8.5);
  const [tenure, setTenure] = useState(20);

  const mr = rate / 12 / 100, n = tenure * 12;
  const emi = loan * mr * Math.pow(1 + mr, n) / (Math.pow(1 + mr, n) - 1);
  const totalPay = emi * n, totalInterest = totalPay - loan;

  return (
    <div>
      <Slider label="Loan Amount" value={loan} min={100000} max={100000000} step={100000} onChange={setLoan} display={rupee(loan)} />
      <Slider label="Interest Rate (p.a.)" value={rate} min={5} max={20} step={0.1} onChange={setRate} display={`${rate}%`} />
      <Slider label="Tenure" value={tenure} min={1} max={30} step={1} onChange={setTenure} display={`${tenure} yrs`} />

      <div style={{ display: "flex", justifyContent: "center", margin: "16px 0 8px" }}>
        <Donut a={loan} b={totalInterest} />
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 14 }}>
        {[["#00d09c", "Principal"], ["#f97316", "Interest"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
            <span style={{ color: "#94a3b8", fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>{l}</span>
          </div>
        ))}
      </div>

      <ResultCard label="Monthly EMI" value={rupee(emi)} accent />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <ResultCard label="Principal" value={rupee(loan)} />
        <ResultCard label="Interest" value={rupee(totalInterest)} />
      </div>
      <div style={{ marginTop: 8 }}><ResultCard label="Total Payment" value={rupee(totalPay)} /></div>
      <StatRow label="Interest as % of loan" value={`${((totalInterest / loan) * 100).toFixed(1)}%`} color="#f97316" />
    </div>
  );
}

// ── SIP + Lumpsum ─────────────────────────────────────────────────────────────
function SIPCalc() {
  const [mode, setMode] = useState("SIP");
  const [monthly, setMonthly] = useState(10000);
  const [sipRate, setSipRate] = useState(12);
  const [sipYears, setSipYears] = useState(15);
  const [lumpsum, setLumpsum] = useState(500000);
  const [lsRate, setLsRate] = useState(12);
  const [lsYears, setLsYears] = useState(10);

  const sipN = sipYears * 12, sipR = sipRate / 12 / 100;
  const sipFV = monthly * ((Math.pow(1 + sipR, sipN) - 1) / sipR) * (1 + sipR);
  const sipInv = monthly * sipN;

  const lsFV = lumpsum * Math.pow(1 + lsRate / 100, lsYears);

  const isSIP = mode === "SIP";
  const fv = isSIP ? sipFV : lsFV;
  const inv = isSIP ? sipInv : lumpsum;
  const ret = fv - inv;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {["SIP", "Lumpsum"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
            background: mode === m ? "linear-gradient(135deg, #00d09c, #00b386)" : "#1e293b",
            color: mode === m ? "#fff" : "#64748b", fontWeight: 700, fontSize: 14,
            fontFamily: "Syne, sans-serif", transition: "all 0.2s",
            boxShadow: mode === m ? "0 4px 14px #00d09c30" : "none"
          }}>{m}</button>
        ))}
      </div>

      {isSIP ? (<>
        <Slider label="Monthly SIP" value={monthly} min={500} max={1000000} step={500} onChange={setMonthly} display={rupee(monthly)} />
        <Slider label="Expected Return (p.a.)" value={sipRate} min={1} max={30} step={0.5} onChange={setSipRate} display={`${sipRate}%`} />
        <Slider label="Investment Period" value={sipYears} min={1} max={40} step={1} onChange={setSipYears} display={`${sipYears} yrs`} />
      </>) : (<>
        <Slider label="Lumpsum Amount" value={lumpsum} min={10000} max={100000000} step={10000} onChange={setLumpsum} display={rupee(lumpsum)} />
        <Slider label="Expected Return (p.a.)" value={lsRate} min={1} max={30} step={0.5} onChange={setLsRate} display={`${lsRate}%`} />
        <Slider label="Investment Period" value={lsYears} min={1} max={40} step={1} onChange={setLsYears} display={`${lsYears} yrs`} />
      </>)}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
        <ResultCard label="Future Value" value={rupee(fv)} accent />
        <ResultCard label="Wealth Gained" value={rupee(ret)} accent />
        <ResultCard label={isSIP ? "Total Invested" : "Invested"} value={rupee(inv)} />
        <ResultCard label="Return Multiple" value={`${(fv / inv).toFixed(2)}x`} />
      </div>
      <GrowthBar invested={inv} returns={ret} />
      <StatRow label={isSIP ? "Daily SIP equivalent" : "CAGR"} value={isSIP ? `\u20B9${fmt(monthly / 30)}/day` : `${lsRate}% p.a.`} />
    </div>
  );
}

// ── FD / RD ───────────────────────────────────────────────────────────────────
function FDCalc() {
  const [mode, setMode] = useState("FD");
  const [principal, setPrincipal] = useState(500000);
  const [rate, setRate] = useState(7.1);
  const [years, setYears] = useState(5);
  const [monthly, setMonthly] = useState(10000);

  let maturity, invested, interest;
  if (mode === "FD") {
    maturity = principal * Math.pow(1 + rate / (4 * 100), 4 * years);
    invested = principal; interest = maturity - invested;
  } else {
    const n = years * 12, r = rate / 12 / 100;
    maturity = monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    invested = monthly * n; interest = maturity - invested;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {["FD", "RD"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
            background: mode === m ? "linear-gradient(135deg, #00d09c, #00b386)" : "#1e293b",
            color: mode === m ? "#fff" : "#64748b", fontWeight: 700, fontSize: 14,
            fontFamily: "Syne, sans-serif", transition: "all 0.2s"
          }}>{m === "FD" ? "Fixed Deposit" : "Recurring Deposit"}</button>
        ))}
      </div>

      {mode === "FD"
        ? <Slider label="Principal Amount" value={principal} min={10000} max={50000000} step={10000} onChange={setPrincipal} display={rupee(principal)} />
        : <Slider label="Monthly Deposit" value={monthly} min={1000} max={500000} step={1000} onChange={setMonthly} display={rupee(monthly)} />
      }
      <Slider label="Interest Rate (p.a.)" value={rate} min={4} max={10} step={0.05} onChange={setRate} display={`${rate}%`} />
      <Slider label="Duration" value={years} min={1} max={10} step={1} onChange={setYears} display={`${years} yrs`} />

      <div style={{ display: "flex", justifyContent: "center", margin: "16px 0 8px" }}>
        <Donut a={invested} b={interest} />
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 14 }}>
        {[["#00d09c", mode === "FD" ? "Principal" : "Deposited"], ["#f97316", "Interest"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
            <span style={{ color: "#94a3b8", fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>{l}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <ResultCard label="Maturity Value" value={rupee(maturity)} accent />
        <ResultCard label="Interest Earned" value={rupee(interest)} accent />
        <ResultCard label={mode === "FD" ? "Principal" : "Total Deposited"} value={rupee(invested)} />
        <ResultCard label="Effective Yield" value={`${((interest / invested) * 100).toFixed(1)}%`} />
      </div>
    </div>
  );
}


// ── FIRE / Retirement Calculator ─────────────────────────────────────────────
function FIRECalc() {
  const [mode, setMode] = useState("need");

  // Mode 1 — What do I need?
  const [monthlyExp, setMonthlyExp] = useState(50000);
  const [yearsToRetire, setYearsToRetire] = useState(20);
  const [inflation, setInflation] = useState(6);
  const [preReturnRate, setPreReturnRate] = useState(12);
  const [withdrawalRate, setWithdrawalRate] = useState(4);

  // Mode 2 — What will I have?
  const [currentCorpus, setCurrentCorpus] = useState(1000000);
  const [monthlySIP, setMonthlySIP] = useState(20000);
  const [haveYears, setHaveYears] = useState(20);
  const [haveReturn, setHaveReturn] = useState(12);
  const [postReturn, setPostReturn] = useState(7);
  const [postInflation, setPostInflation] = useState(6);

  // ── Mode 1 calculations ──
  const annualExpToday = monthlyExp * 12;
  const annualExpAtRetirement = annualExpToday * Math.pow(1 + inflation / 100, yearsToRetire);
  const monthlyExpAtRetirement = annualExpAtRetirement / 12;
  const fireNumber = annualExpAtRetirement / (withdrawalRate / 100);
  // Monthly SIP needed to reach FIRE number
  const r1 = preReturnRate / 12 / 100, n1 = yearsToRetire * 12;
  const sipNeeded = fireNumber / (((Math.pow(1 + r1, n1) - 1) / r1) * (1 + r1));
  // Real return (inflation-adjusted)
  const realReturn = ((1 + preReturnRate / 100) / (1 + inflation / 100) - 1) * 100;

  // ── Mode 2 calculations ──
  const n2 = haveYears * 12, r2 = haveReturn / 12 / 100;
  const sipFV = monthlySIP * ((Math.pow(1 + r2, n2) - 1) / r2) * (1 + r2);
  const corpusFV = currentCorpus * Math.pow(1 + haveReturn / 100, haveYears);
  const totalCorpus = sipFV + corpusFV;
  const monthlyIncome = (totalCorpus * (withdrawalRate / 100)) / 12;
  // Corpus survival — how many years does it last?
  const monthlyPostReturn = postReturn / 12 / 100;
  const monthlyInflAdj = monthlyIncome * Math.pow(1 + inflation / 100, haveYears);
  let survivalYears = 0;
  let bal = totalCorpus;
  let withdrawal = monthlyInflAdj;
  while (bal > 0 && survivalYears < 100) {
    for (let m = 0; m < 12; m++) {
      bal = bal * (1 + monthlyPostReturn) - withdrawal;
      if (bal <= 0) break;
    }
    withdrawal *= (1 + postInflation / 100);
    survivalYears++;
    if (survivalYears >= 100) break;
  }
  const corpusForever = totalCorpus * (monthlyPostReturn * 12) > monthlyInflAdj * 12;

  const isNeed = mode === "need";

  // Survival bar colour
  const survivalColor = survivalYears >= 30 ? "#00d09c" : survivalYears >= 20 ? "#f59e0b" : "#ef4444";

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {[["need", "🎯 What do I need?"], ["have", "💰 What will I have?"]].map(([m, lbl]) => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: "10px 6px", borderRadius: 12, border: "none", cursor: "pointer",
            background: mode === m ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#1e293b",
            color: mode === m ? "#fff" : "#64748b", fontWeight: 700, fontSize: 12,
            fontFamily: "Syne, sans-serif", transition: "all 0.2s",
            boxShadow: mode === m ? "0 4px 14px #6366f130" : "none"
          }}>{lbl}</button>
        ))}
      </div>

      {isNeed ? (<>
        <Slider label="Monthly Expenses Today" value={monthlyExp} min={10000} max={500000} step={5000} onChange={setMonthlyExp} display={rupee(monthlyExp)} />
        <Slider label="Years to Retirement" value={yearsToRetire} min={1} max={40} step={1} onChange={setYearsToRetire} display={`${yearsToRetire} yrs`} />
        <Slider label="Expected Inflation (p.a.)" value={inflation} min={2} max={12} step={0.5} onChange={setInflation} display={`${inflation}%`} />
        <Slider label="Pre-retirement Return" value={preReturnRate} min={5} max={20} step={0.5} onChange={setPreReturnRate} display={`${preReturnRate}%`} />
        <Slider label="Withdrawal Rate" value={withdrawalRate} min={2} max={8} step={0.5} onChange={setWithdrawalRate} display={`${withdrawalRate}%`} />

        {/* FIRE Number — hero */}
        <div style={{ background: "linear-gradient(135deg, #6366f122, #8b5cf611)", border: "1px solid #6366f144", borderRadius: 16, padding: "20px 16px", textAlign: "center", marginBottom: 10 }}>
          <div style={{ color: "#a5b4fc", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontFamily: "DM Sans, sans-serif", marginBottom: 6 }}>Your FIRE Number</div>
          <div style={{ color: "#818cf8", fontSize: 32, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>{rupee(fireNumber)}</div>
          <div style={{ color: "#64748b", fontSize: 11, marginTop: 6, fontFamily: "DM Sans, sans-serif" }}>corpus needed to retire in {yearsToRetire} years</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <ResultCard label="Monthly Expense at Retirement" value={rupee(monthlyExpAtRetirement)} />
          <ResultCard label="SIP Needed / Month" value={rupee(sipNeeded)} accent />
          <ResultCard label="Real Return (inflation-adj)" value={`${realReturn.toFixed(1)}%`} />
          <ResultCard label="Withdrawal Rate" value={`${withdrawalRate}% p.a.`} />
        </div>

        <StatRow label="Annual expense at retirement" value={rupee(annualExpAtRetirement)} color="#a5b4fc" />
        <StatRow label="Inflation multiplier" value={`${Math.pow(1 + inflation / 100, yearsToRetire).toFixed(2)}x`} color="#f59e0b" />

      </>) : (<>
        <Slider label="Current Savings / Corpus" value={currentCorpus} min={0} max={50000000} step={50000} onChange={setCurrentCorpus} display={rupee(currentCorpus)} />
        <Slider label="Monthly SIP" value={monthlySIP} min={0} max={500000} step={1000} onChange={setMonthlySIP} display={rupee(monthlySIP)} />
        <Slider label="Years to Retirement" value={haveYears} min={1} max={40} step={1} onChange={setHaveYears} display={`${haveYears} yrs`} />
        <Slider label="Pre-retirement Return" value={haveReturn} min={5} max={20} step={0.5} onChange={setHaveReturn} display={`${haveReturn}%`} />
        <Slider label="Post-retirement Return" value={postReturn} min={3} max={12} step={0.5} onChange={setPostReturn} display={`${postReturn}%`} />
        <Slider label="Post-retirement Inflation" value={postInflation} min={2} max={10} step={0.5} onChange={setPostInflation} display={`${postInflation}%`} />

        {/* Projected corpus hero */}
        <div style={{ background: "linear-gradient(135deg, #6366f122, #8b5cf611)", border: "1px solid #6366f144", borderRadius: 16, padding: "20px 16px", textAlign: "center", marginBottom: 10 }}>
          <div style={{ color: "#a5b4fc", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontFamily: "DM Sans, sans-serif", marginBottom: 6 }}>Projected Corpus at Retirement</div>
          <div style={{ color: "#818cf8", fontSize: 32, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>{rupee(totalCorpus)}</div>
          <div style={{ color: "#64748b", fontSize: 11, marginTop: 6, fontFamily: "DM Sans, sans-serif" }}>in {haveYears} years at {haveReturn}% return</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <ResultCard label="Monthly Passive Income" value={rupee(monthlyIncome)} accent />
          <ResultCard label="From SIP Growth" value={rupee(sipFV)} />
          <ResultCard label="From Current Corpus" value={rupee(corpusFV)} />
          <ResultCard label="Withdrawal Rate" value={`${withdrawalRate}%`} />
        </div>

        {/* Corpus survival indicator */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: "16px 16px", marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "DM Sans, sans-serif" }}>Corpus lasts</span>
            <span style={{ color: survivalColor, fontWeight: 800, fontSize: 15, fontFamily: "Syne, sans-serif" }}>
              {corpusForever ? "Forever ♾" : `${survivalYears} years`}
            </span>
          </div>
          {!corpusForever && (
            <>
              <div style={{ background: "#1e293b", borderRadius: 8, height: 10, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (survivalYears / 40) * 100)}%`, background: survivalColor, height: "100%", borderRadius: 8, transition: "width 0.4s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ color: "#475569", fontSize: 10, fontFamily: "DM Sans, sans-serif" }}>0</span>
                <span style={{ color: "#475569", fontSize: 10, fontFamily: "DM Sans, sans-serif" }}>40 yrs</span>
              </div>
              <div style={{ color: "#64748b", fontSize: 11, marginTop: 8, fontFamily: "DM Sans, sans-serif" }}>
                {survivalYears < 20 ? "⚠️ Corpus may run out. Increase SIP or reduce withdrawal rate." : survivalYears < 30 ? "Decent runway. Consider boosting corpus for extra cushion." : "✅ Strong retirement corpus. You're on track."}
              </div>
            </>
          )}
          {corpusForever && <div style={{ color: "#00d09c", fontSize: 11, marginTop: 4, fontFamily: "DM Sans, sans-serif" }}>✅ Your corpus generates more than you withdraw. Wealth compounds forever.</div>}
        </div>

        <StatRow label="Withdrawal slider" value={`${withdrawalRate}% — adjust in Mode 1`} color="#a5b4fc" />
      </>)}
    </div>
  );
}


// ── CTC to In-Hand Calculator (New Tax Regime FY2025-26) ─────────────────────
function CTCCalc() {
  const [ctc, setCtc] = useState(1200000);
  const [basicPct, setBasicPct] = useState(40);
  const [hraPct, setHraPct] = useState(20);
  const [pfOpt, setPfOpt] = useState(true);
  const [npsOpt, setNpsOpt] = useState(false);
  const [lta, setLta] = useState(true);
  const [mealAllowance, setMealAllowance] = useState(true);
  const [bonus, setBonus] = useState(0);
  const [esop, setEsop] = useState(0);
  const [showOptimiser, setShowOptimiser] = useState(false);

  const stdDeduction = 75000;
  const professionalTax = 2400;

  // ── Reusable calc function — works for any set of inputs ──
  const calcScenario = (bPct, hPct, pf, nps, ltaOn, mealOn) => {
    const basic = ctc * (bPct / 100);
    const hra = ctc * (hPct / 100);
    const pfEmp = pf ? Math.min(basic * 0.12, 21600) : 0;
    const pfEmpr = pf ? Math.min(basic * 0.12, 21600) : 0;
    const npsEmpr = nps ? Math.min(basic * 0.10, 150000) : 0;
    const ltaAmt = ltaOn ? Math.min(ctc * 0.05, 50000) : 0;
    const mealAmt = mealOn ? 26400 : 0;
    const special = Math.max(0, ctc - basic - hra - pfEmpr - npsEmpr - ltaAmt - mealAmt);
    const gross = basic + hra + ltaAmt + mealAmt + special;
    const totalIncome = gross + bonus + esop;
    const taxable = Math.max(0, totalIncome - stdDeduction - pfEmp);

    const calcTax = (inc) => {
      if (inc <= 300000) return 0;
      let t = 0;
      [[300000,700000,0.05],[700000,1000000,0.10],[1000000,1200000,0.15],[1200000,1500000,0.20],[1500000,Infinity,0.30]]
        .forEach(([lo, hi, r]) => { if (inc > lo) t += (Math.min(inc, hi) - lo) * r; });
      return t;
    };

    let tax = taxable <= 700000 ? 0 : calcTax(taxable);
    let surcharge = 0;
    if (taxable > 5000000) surcharge = tax * 0.10;
    if (taxable > 10000000) surcharge = tax * 0.15;
    const cess = (tax + surcharge) * 0.04;
    const totalTax = tax + surcharge + cess;
    const totalDed = totalTax + pfEmp + professionalTax;
    const monthlyInHand = (gross - totalDed) / 12;
    const effectiveTaxRate = gross > 0 ? (totalTax / gross) * 100 : 0;
    return { monthlyInHand, totalTax, effectiveTaxRate, gross, pfEmp, taxable, totalDed };
  };

  // ── Current scenario (live from sliders/toggles) ──
  const current = calcScenario(basicPct, hraPct, pfOpt, npsOpt, lta, mealAllowance);

  // ── Optimised scenario (always fully optimised from current CTC) ──
  const optimised = calcScenario(35, hraPct, pfOpt, true, true, true);

  // Annual saving potential
  const annualSaving = (optimised.monthlyInHand - current.monthlyInHand) * 12;

  // ── Tips — each knows if it's already applied ──
  const tips = [
    {
      applied: basicPct <= 35,
      label: "Lower Basic to 35%",
      desc: "Reduces PF deduction and shifts more to tax-efficient allowances",
      action: () => setBasicPct(35),
    },
    {
      applied: npsOpt,
      label: "Add NPS Employer (10% of basic)",
      desc: "Section 80CCD(2) — tax-free in new regime, builds retirement corpus",
      action: () => setNpsOpt(true),
    },
    {
      applied: mealAllowance,
      label: "Add Meal Allowance ₹2,200/mo",
      desc: "₹26,400/year completely tax-free as food coupon/allowance",
      action: () => setMealAllowance(true),
    },
    {
      applied: lta,
      label: "Add LTA Component",
      desc: "Tax-free reimbursement twice in a 4-year block for travel",
      action: () => setLta(true),
    },
  ];

  const unappliedTips = tips.filter(t => !t.applied);
  const allApplied = unappliedTips.length === 0;

  const taxColor = (r) => r < 10 ? "#00d09c" : r < 20 ? "#f59e0b" : "#ef4444";

  const Toggle = ({ label, value, onChange }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e293b" }}>
      <span style={{ color: "#94a3b8", fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", transition: "background 0.2s", background: value ? "#00d09c" : "#334155", position: "relative" }}>
        <div style={{ position: "absolute", top: 3, left: value ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </div>
    </div>
  );

  return (
    <div>
      {/* CTC + structure */}
      <Slider label="Annual CTC" value={ctc} min={300000} max={10000000} step={50000} onChange={setCtc} display={rupee(ctc)} />
      <Slider label="Basic % of CTC" value={basicPct} min={30} max={60} step={5} onChange={setBasicPct} display={`${basicPct}%`} />
      <Slider label="HRA % of CTC" value={hraPct} min={10} max={30} step={5} onChange={setHraPct} display={`${hraPct}%`} />

      {/* Toggles */}
      <div style={{ marginBottom: 18 }}>
        <Toggle label="PF Contribution (12% of basic)" value={pfOpt} onChange={setPfOpt} />
        <Toggle label="NPS Employer (10% basic, tax-free)" value={npsOpt} onChange={setNpsOpt} />
        <Toggle label="LTA Component" value={lta} onChange={setLta} />
        <Toggle label="Meal Allowance ₹2,200/mo" value={mealAllowance} onChange={setMealAllowance} />
      </div>

      {/* Bonus + ESOP */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "DM Sans, sans-serif", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Additional Income</div>
        <Slider label="Annual Bonus" value={bonus} min={0} max={5000000} step={25000} onChange={setBonus} display={bonus > 0 ? rupee(bonus) : "None"} />
        <Slider label="ESOP Exercise Value" value={esop} min={0} max={10000000} step={50000} onChange={setEsop} display={esop > 0 ? rupee(esop) : "None"} />
      </div>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #00d09c22, #00b38611)", border: "1px solid #00d09c44", borderRadius: 16, padding: "18px 16px", textAlign: "center", marginBottom: 10 }}>
        <div style={{ color: "#6ee7b7", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontFamily: "DM Sans, sans-serif", marginBottom: 4 }}>Monthly In-Hand</div>
        <div style={{ color: "#00d09c", fontSize: 34, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>{rupee(current.monthlyInHand)}</div>
        <div style={{ color: "#64748b", fontSize: 11, marginTop: 6, fontFamily: "DM Sans, sans-serif" }}>
          Annual take-home: {rupee(current.monthlyInHand * 12)}{(bonus > 0 || esop > 0) ? " (excl. bonus/ESOP)" : ""}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <ResultCard label="Income Tax" value={rupee(current.totalTax)} />
        <ResultCard label="Effective Tax Rate" value={`${current.effectiveTaxRate.toFixed(1)}%`} />
        <ResultCard label="PF (Employee)" value={rupee(current.pfEmp * 12)} />
        <ResultCard label="Gross Salary" value={rupee(current.gross)} />
      </div>

      {/* Tax burden bar — always reflects current state */}
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "#64748b", fontSize: 12, fontFamily: "DM Sans, sans-serif" }}>Tax burden</span>
          <span style={{ color: taxColor(current.effectiveTaxRate), fontWeight: 700, fontSize: 13, fontFamily: "Syne, sans-serif" }}>{current.effectiveTaxRate.toFixed(1)}%</span>
        </div>
        <div style={{ background: "#1e293b", borderRadius: 6, height: 8 }}>
          <div style={{ width: `${Math.min(100, current.effectiveTaxRate * 3)}%`, background: taxColor(current.effectiveTaxRate), height: "100%", borderRadius: 6, transition: "width 0.4s" }} />
        </div>
        <div style={{ color: "#475569", fontSize: 10, marginTop: 6, fontFamily: "DM Sans, sans-serif" }}>
          {current.effectiveTaxRate < 5 ? "✅ Excellent — nearly tax-free" : current.effectiveTaxRate < 15 ? "👍 Good tax efficiency" : current.effectiveTaxRate < 25 ? "⚠️ Room to optimise your structure" : "🔴 High tax — restructure your CTC"}
        </div>
      </div>

      {/* ESOP/Bonus note */}
      {(bonus > 0 || esop > 0) && (
        <div style={{ background: "#0f172a", border: "1px solid #f59e0b33", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
          <div style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, fontFamily: "Syne, sans-serif", marginBottom: 6 }}>⚡ Bonus & ESOP Tax</div>
          {bonus > 0 && <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "DM Sans, sans-serif", marginBottom: 4 }}>Bonus taxed at your slab rate. TDS deducted by employer at payout.</div>}
          {esop > 0 && <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>ESOP: perquisite tax at exercise (FMV − strike price). Separate LTCG/STCG when you sell. <span style={{ color: "#6366f1" }}>Hold 12+ months for 10% LTCG.</span></div>}
        </div>
      )}

      {/* Negotiation Optimiser */}
      <div style={{ background: "#0f172a", border: "1px solid #6366f133", borderRadius: 14, overflow: "hidden" }}>
        <div onClick={() => setShowOptimiser(!showOptimiser)} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#a5b4fc", fontSize: 13, fontWeight: 700, fontFamily: "Syne, sans-serif" }}>
              💡 Negotiation Optimiser {allApplied ? "✅" : ""}
            </div>
            <div style={{ color: "#475569", fontSize: 11, marginTop: 2, fontFamily: "DM Sans, sans-serif" }}>
              {allApplied ? "All optimisations applied — max take-home achieved" : `Apply all → save ${rupee(annualSaving)} more/year`}
            </div>
          </div>
          <div style={{ color: "#6366f1", fontSize: 16 }}>{showOptimiser ? "▲" : "▼"}</div>
        </div>

        {showOptimiser && (
          <div style={{ padding: "0 16px 16px" }}>

            {/* Current vs Optimised — both derived from same calcScenario */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <div style={{ background: "#1e293b", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "DM Sans, sans-serif" }}>Current Monthly</div>
                <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{rupee(current.monthlyInHand)}</div>
                <div style={{ color: "#64748b", fontSize: 10, marginTop: 3, fontFamily: "DM Sans, sans-serif" }}>{current.effectiveTaxRate.toFixed(1)}% tax</div>
              </div>
              <div style={{ background: "linear-gradient(135deg, #6366f122, #8b5cf611)", border: "1px solid #6366f144", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ color: "#a5b4fc", fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "DM Sans, sans-serif" }}>Fully Optimised</div>
                <div style={{ color: "#818cf8", fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{rupee(optimised.monthlyInHand)}</div>
                <div style={{ color: "#64748b", fontSize: 10, marginTop: 3, fontFamily: "DM Sans, sans-serif" }}>{optimised.effectiveTaxRate.toFixed(1)}% tax</div>
              </div>
            </div>

            {/* Tips — greyed when applied */}
            {tips.map(({ applied, label, desc, action }) => (
              <div key={label} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8, padding: "10px 12px", background: applied ? "#0a0f1e" : "#111827", borderRadius: 10, border: `1px solid ${applied ? "#1e293b" : "#334155"}`, opacity: applied ? 0.5 : 1 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: applied ? "#475569" : "#e2e8f0", fontSize: 12, fontWeight: 600, fontFamily: "DM Sans, sans-serif", marginBottom: 2, textDecoration: applied ? "line-through" : "none" }}>{label}</div>
                  <div style={{ color: "#475569", fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>{desc}</div>
                </div>
                <button onClick={action} disabled={applied} style={{
                  flexShrink: 0, padding: "5px 12px", borderRadius: 8, border: "none",
                  cursor: applied ? "default" : "pointer",
                  background: applied ? "#1e293b" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: applied ? "#475569" : "#fff",
                  fontSize: 11, fontWeight: 700, fontFamily: "Syne, sans-serif", whiteSpace: "nowrap",
                  transition: "all 0.2s"
                }}>{applied ? "Applied ✓" : "Apply"}</button>
              </div>
            ))}

            {/* Apply all */}
            {!allApplied && (
              <button onClick={() => { setBasicPct(35); setNpsOpt(true); setMealAllowance(true); setLta(true); }} style={{
                width: "100%", padding: "10px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #00d09c, #00b386)", color: "#fff",
                fontSize: 13, fontWeight: 700, fontFamily: "Syne, sans-serif", marginTop: 4
              }}>⚡ Apply All Optimisations</button>
            )}

            <div style={{ color: "#334155", fontSize: 10, fontFamily: "DM Sans, sans-serif", lineHeight: 1.5, marginTop: 12 }}>
              * New Tax Regime FY2025-26. Std deduction ₹75K. Rebate u/s 87A for taxable income ≤ ₹7L. Consult a CA for exact figures.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────

// ── PPF Calculator ─────────────────────────────────────────────────────────────
function PPFCalc() {
  const [yearly, setYearly] = useState(150000);
  const [years, setYears] = useState(15);
  const [rate] = useState(7.1); // PPF rate is government fixed

  // PPF compounds annually, deposits assumed at start of year
  let balance = 0;
  let totalInvested = 0;
  const yearlyData = [];
  for (let y = 1; y <= years; y++) {
    balance = (balance + yearly) * (1 + rate / 100);
    totalInvested += yearly;
    yearlyData.push({ year: y, balance: Math.round(balance), invested: totalInvested });
  }
  const maturity = balance;
  const interest = maturity - totalInvested;
  const effectiveReturn = ((maturity / totalInvested - 1) * 100).toFixed(1);

  // Extension scenarios (PPF can extend in 5-yr blocks)
  const ext5 = (() => {
    let b = balance;
    for (let y = 0; y < 5; y++) b = (b + yearly) * (1 + rate / 100);
    return b;
  })();
  const ext10 = (() => {
    let b = balance;
    for (let y = 0; y < 10; y++) b = (b + yearly) * (1 + rate / 100);
    return b;
  })();

  return (
    <div>
      {/* PPF rate badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
        <div>
          <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>Current PPF Rate (Govt. Fixed)</div>
          <div style={{ color: "#f1f5f9", fontSize: 11, fontFamily: "DM Sans, sans-serif", marginTop: 2 }}>Reviewed quarterly · Tax-free · EEE status</div>
        </div>
        <div style={{ color: "#00d09c", fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>7.1%</div>
      </div>

      <Slider label="Yearly Investment" value={yearly} min={500} max={150000} step={500}
        onChange={setYearly} display={rupee(yearly)} />
      <div style={{ color: "#475569", fontSize: 11, fontFamily: "DM Sans, sans-serif", marginTop: -14, marginBottom: 18 }}>
        Max ₹1.5L/year allowed under PPF rules
      </div>

      <Slider label="Investment Period" value={years} min={15} max={30} step={1}
        onChange={setYears} display={`${years} yrs`} />
      <div style={{ color: "#475569", fontSize: 11, fontFamily: "DM Sans, sans-serif", marginTop: -14, marginBottom: 18 }}>
        Minimum 15 yrs · Extendable in 5-yr blocks after maturity
      </div>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #00d09c22, #00b38611)", border: "1px solid #00d09c44", borderRadius: 16, padding: "20px 16px", textAlign: "center", marginBottom: 10 }}>
        <div style={{ color: "#6ee7b7", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontFamily: "DM Sans, sans-serif", marginBottom: 4 }}>Maturity Value ({years} years)</div>
        <div style={{ color: "#00d09c", fontSize: 34, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>{rupee(maturity)}</div>
        <div style={{ color: "#64748b", fontSize: 11, marginTop: 6, fontFamily: "DM Sans, sans-serif" }}>
          100% tax-free · No LTCG · No wealth tax
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <ResultCard label="Total Invested" value={rupee(totalInvested)} />
        <ResultCard label="Interest Earned" value={rupee(interest)} accent />
        <ResultCard label="Wealth Multiple" value={`${(maturity / totalInvested).toFixed(2)}x`} />
        <ResultCard label="Effective Return" value={`${effectiveReturn}%`} />
      </div>

      <GrowthBar invested={totalInvested} returns={interest} />

      {/* Extension scenarios */}
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: "14px 16px", marginTop: 12 }}>
        <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, fontFamily: "Syne, sans-serif", marginBottom: 12 }}>
          🔄 Extension Scenarios
        </div>
        <div style={{ color: "#64748b", fontSize: 11, fontFamily: "DM Sans, sans-serif", marginBottom: 12 }}>
          PPF can be extended in 5-year blocks after maturity
        </div>
        {[[`${years} yrs (Maturity)`, maturity, "#00d09c"], [`${years + 5} yrs (+5 ext)`, ext5, "#3b82f6"], [`${years + 10} yrs (+10 ext)`, ext10, "#8b5cf6"]].map(([label, val, color]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e293b" }}>
            <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "DM Sans, sans-serif" }}>{label}</span>
            <span style={{ color, fontWeight: 700, fontSize: 14, fontFamily: "Syne, sans-serif" }}>{rupee(val)}</span>
          </div>
        ))}
      </div>

      {/* Tax benefit callout */}
      <div style={{ background: "linear-gradient(135deg, #6366f115, #8b5cf60a)", border: "1px solid #6366f133", borderRadius: 12, padding: "12px 14px", marginTop: 10 }}>
        <div style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 700, fontFamily: "Syne, sans-serif", marginBottom: 6 }}>💜 EEE Tax Status — Triple Exempt</div>
        {[
          ["Invest", "Deposits qualify under 80C (old regime)"],
          ["Earn", "Interest is fully tax-free every year"],
          ["Withdraw", "Maturity amount 100% tax-free"],
        ].map(([stage, desc]) => (
          <div key={stage} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "#6366f1", fontSize: 11, fontWeight: 700, fontFamily: "Syne, sans-serif", width: 50, flexShrink: 0 }}>{stage}</span>
            <span style={{ color: "#64748b", fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Email Capture Modal ───────────────────────────────────────────────────────
function EmailModal({ onClose, subject, body, source }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [msg, setMsg] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const handleSubmit = async () => {
    if (!validEmail(email)) { setMsg("Please enter a valid email."); return; }
    if (!canSubmit(email))  { setMsg("Please wait 60 seconds before submitting again."); return; }
    setStatus("sending");
    const { error } = await sbInsert("email_subscribers", {
      email,
      source,
      created_at: new Date().toISOString(),
    });
    if (error && !error.includes("duplicate")) {
      setStatus("error");
      setMsg(supabaseReady ? "Something went wrong. Try again." : "⚠️ Supabase not connected yet — add your keys to activate.");
      return;
    }
    // Send calculation via mailto as fallback (works without backend)
    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto);
    setStatus("done");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000bb", zIndex: 100, display: "flex", alignItems: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#111827", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", width: "100%", border: "1px solid #1e293b" }}>
        {status === "done" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 8 }}>Check your inbox!</div>
            <div style={{ color: "#64748b", fontSize: 13, fontFamily: "DM Sans, sans-serif", marginBottom: 24 }}>Your calculation has been sent to {email}</div>
            <button onClick={onClose} style={{ background: "linear-gradient(135deg, #00d09c, #00b386)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 32px", fontSize: 14, fontWeight: 700, fontFamily: "Syne, sans-serif", cursor: "pointer" }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 4 }}>Email this calculation</div>
            <div style={{ color: "#64748b", fontSize: 13, fontFamily: "DM Sans, sans-serif", marginBottom: 20 }}>We'll send your results + save you a spot for new calculators.</div>
            <input ref={inputRef} type="email" placeholder="your@email.com" value={email}
              onChange={(e) => { setEmail(e.target.value); setMsg(""); }}
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px", color: "#f1f5f9", fontSize: 14, fontFamily: "DM Sans, sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
            />
            {msg && <div style={{ color: "#f97316", fontSize: 12, fontFamily: "DM Sans, sans-serif", marginBottom: 10 }}>{msg}</div>}
            <button onClick={handleSubmit} disabled={status === "sending"} style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none", cursor: status === "sending" ? "wait" : "pointer",
              background: "linear-gradient(135deg, #00d09c, #00b386)", color: "#fff",
              fontSize: 15, fontWeight: 700, fontFamily: "Syne, sans-serif",
              opacity: status === "sending" ? 0.7 : 1
            }}>{status === "sending" ? "Sending…" : "Send & Save →"}</button>
            <div style={{ color: "#334155", fontSize: 11, fontFamily: "DM Sans, sans-serif", textAlign: "center", marginTop: 12 }}>No spam. Unsubscribe anytime.</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Notify Me Modal (no calculation body) ─────────────────────────────────────
function NotifyModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [msg, setMsg] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const handleSubmit = async () => {
    if (!validEmail(email)) { setMsg("Please enter a valid email."); return; }
    if (!canSubmit(email))  { setMsg("Please wait 60 seconds before trying again."); return; }
    setStatus("sending");
    const { error } = await sbInsert("email_subscribers", {
      email,
      source: "notify_me",
      created_at: new Date().toISOString(),
    });
    if (error && !error.includes("duplicate")) {
      setStatus("error");
      setMsg(supabaseReady ? "Something went wrong. Try again." : "⚠️ Supabase not connected yet — add your keys to activate.");
      return;
    }
    setStatus("done");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000bb", zIndex: 100, display: "flex", alignItems: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#111827", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", width: "100%", border: "1px solid #1e293b" }}>
        {status === "done" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 8 }}>You're on the list!</div>
            <div style={{ color: "#64748b", fontSize: 13, fontFamily: "DM Sans, sans-serif", marginBottom: 24 }}>We'll notify you when new calculators drop.</div>
            <button onClick={onClose} style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 32px", fontSize: 14, fontWeight: 700, fontFamily: "Syne, sans-serif", cursor: "pointer" }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 4 }}>Get notified 🔔</div>
            <div style={{ color: "#64748b", fontSize: 13, fontFamily: "DM Sans, sans-serif", marginBottom: 20 }}>Tax regime, NPS, Rent vs Buy and more — be first to know.</div>
            <input ref={inputRef} type="email" placeholder="your@email.com" value={email}
              onChange={(e) => { setEmail(e.target.value); setMsg(""); }}
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px", color: "#f1f5f9", fontSize: 14, fontFamily: "DM Sans, sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
            />
            {msg && <div style={{ color: "#f97316", fontSize: 12, fontFamily: "DM Sans, sans-serif", marginBottom: 10 }}>{msg}</div>}
            <button onClick={handleSubmit} disabled={status === "sending"} style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none", cursor: status === "sending" ? "wait" : "pointer",
              background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff",
              fontSize: 15, fontWeight: 700, fontFamily: "Syne, sans-serif",
              opacity: status === "sending" ? 0.7 : 1
            }}>{status === "sending" ? "Saving…" : "Notify Me →"}</button>
            <div style={{ color: "#334155", fontSize: 11, fontFamily: "DM Sans, sans-serif", textAlign: "center", marginTop: 12 }}>No spam. Unsubscribe anytime.</div>
          </>
        )}
      </div>
    </div>
  );
}


// ── Affiliate links — swap in your actual affiliate URLs ─────────────────────
const AFFILIATES = {
  emi:  { label: "Compare home loan rates", url: "https://www.paisabazaar.com/home-loan/?ref=paisamarg", cta: "Check Rates →" },
  sip:  { label: "Start this SIP on Groww", url: "https://groww.in/?ref=paisamarg", cta: "Invest on Groww →" },
  fd:   { label: "Best FD rates right now", url: "https://www.bankbazaar.com/fixed-deposit.html?ref=paisamarg", cta: "Compare FDs →" },
  ppf:  { label: "Open PPF — SBI / Post Office", url: "https://www.onlinesbi.sbi/?ref=paisamarg", cta: "Open Account →" },
  fire: { label: "Start retirement SIP on Coin", url: "https://coin.zerodha.com/?ref=paisamarg", cta: "Invest on Zerodha →" },
  ctc:  { label: "Find higher-paying roles", url: "https://www.naukri.com/?ref=paisamarg", cta: "Browse Jobs →" },
};

function AffiliateNudge({ calcId }) {
  const aff = AFFILIATES[calcId];
  if (!aff) return null;
  return (
    <a href={aff.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", marginTop: 14 }}>
      <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", border: "1px solid #334155", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 10, fontFamily: "DM Sans, sans-serif", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Sponsored</div>
          <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, fontFamily: "DM Sans, sans-serif" }}>{aff.label}</div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #00d09c, #00b386)", color: "#fff", padding: "7px 12px", borderRadius: 10, fontSize: 11, fontWeight: 700, fontFamily: "Syne, sans-serif", whiteSpace: "nowrap", marginLeft: 10 }}>{aff.cta}</div>
      </div>
    </a>
  );
}


// ── Per-calculator disclaimers ─────────────────────────────────────────────
const DISCLAIMERS = {
  emi:  "Actual EMI may vary based on lender processing fees, GST charges, and exact disbursement date. Rate shown is reducing balance. Consult your lender for a final amortisation schedule.",
  sip:  "Mutual fund investments are subject to market risks. Returns shown are based on assumed rates and are not guaranteed. Past performance is not indicative of future results. Read all scheme documents carefully.",
  fd:   "Interest rates vary by bank, tenure and deposit amount. Senior citizen rates may differ. TDS applicable on interest above ₹40,000/year (₹50,000 for seniors).",
  ppf:  "PPF interest rate is set by the Government of India and reviewed quarterly. The 7.1% rate is current as of FY2025-26 and may change. Partial withdrawal rules apply after year 6.",
  fire: "Retirement projections are illustrative estimates based on assumed inflation and return rates. Actual outcomes will vary. This is not a financial plan. Consult a SEBI-registered investment advisor.",
  ctc:  "Tax calculations are indicative under the New Tax Regime FY2025-26. Actual liability depends on your specific salary structure, exemptions, and employer TDS. Consult a qualified CA for exact figures.",
};

// ── Disclaimer bar shown at bottom of each calculator ─────────────────────
function DisclaimerBar({ calcId }) {
  const [expanded, setExpanded] = useState(false);
  const text = DISCLAIMERS[calcId];
  if (!text) return null;
  return (
    <div style={{ marginTop: 14, background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ color: "#475569", fontSize: 11, fontFamily: "DM Sans, sans-serif", lineHeight: 1.5, flex: 1 }}>
          ⚠️ {expanded ? text : text.slice(0, 80) + (text.length > 80 ? "…" : "")}
        </div>
        {text.length > 80 && (
          <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "DM Sans, sans-serif", flexShrink: 0, padding: 0 }}>
            {expanded ? "Less" : "More"}
          </button>
        )}
      </div>
      <div style={{ color: "#334155", fontSize: 10, fontFamily: "DM Sans, sans-serif", marginTop: 6 }}>
        For reference only · Not financial advice · Consult a CA or SEBI-registered advisor
      </div>
    </div>
  );
}

// ── Media.net ad slot placeholder ─────────────────────────────────────────
// Replace data-slot with your Media.net publisher ID when approved
// Sign up at: media.net/publishers
function AdSlot({ position = "inline" }) {
  return (
    <div style={{
      margin: "14px 0",
      background: "#0a0f1e",
      border: "1px dashed #1e293b",
      borderRadius: 12,
      padding: "14px",
      textAlign: "center",
      minHeight: position === "banner" ? 90 : 60,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4
    }}>
      {/* ── SWAP THIS BLOCK with your Media.net tag when approved ── */}
      {/* <script async src="https://boot.md.nl/boomerang/PUBLISHER_ID.js"></script> */}
      <div style={{ color: "#1e293b", fontSize: 10, fontFamily: "DM Sans, sans-serif" }}>Ad</div>
      <div style={{ color: "#1e293b", fontSize: 9, fontFamily: "DM Sans, sans-serif" }}>media.net slot — activate after approval</div>
    </div>
  );
}

// ── Global disclaimer modal — shown once on first visit ───────────────────
function GlobalDisclaimer({ onAccept }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#111827", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", width: "100%", border: "1px solid #1e293b", boxSizing: "border-box" }}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>📊</div>
        <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 10, textAlign: "center" }}>
          For Reference Only
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, fontFamily: "DM Sans, sans-serif", lineHeight: 1.6, marginBottom: 8 }}>
          PaisaMarg calculators provide <strong style={{ color: "#e2e8f0" }}>indicative estimates</strong> for educational purposes only.
        </div>
        <div style={{ color: "#64748b", fontSize: 12, fontFamily: "DM Sans, sans-serif", lineHeight: 1.6, marginBottom: 20 }}>
          Results are based on inputs and assumed rates — they do not constitute financial, tax, or investment advice. Market returns are not guaranteed. Tax calculations may vary based on your individual circumstances.
          <br /><br />
          Always consult a <strong style={{ color: "#94a3b8" }}>qualified CA</strong> or <strong style={{ color: "#94a3b8" }}>SEBI-registered investment advisor</strong> before making financial decisions.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            ["🏦", "Not a bank or broker"],
            ["📈", "Returns are assumptions"],
            ["💼", "Not a CA or advisor"],
            ["⚖️", "Not legal/tax advice"],
          ].map(([icon, text]) => (
            <div key={text} style={{ background: "#0f172a", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ color: "#64748b", fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>{text}</span>
            </div>
          ))}
        </div>
        <button onClick={onAccept} style={{
          width: "100%", marginTop: 20, padding: "15px", borderRadius: 14, border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #00d09c, #00b386)", color: "#fff",
          fontSize: 15, fontWeight: 800, fontFamily: "Syne, sans-serif"
        }}>I Understand — Let me Calculate</button>
        <div style={{ color: "#334155", fontSize: 10, fontFamily: "DM Sans, sans-serif", textAlign: "center", marginTop: 10 }}>
          Shown once · Stored locally · No data collected
        </div>
      </div>
    </div>
  );
}

// ── Calculator registry ────────────────────────────────────────────────────────
const CALCULATORS = [
  {
    id: "emi", label: "EMI Calculator", icon: "🏠",
    tagline: "Know your EMI before you sign",
    category: "borrow", color: "#3b82f6",
    component: EMICalc,
  },
  {
    id: "sip", label: "SIP & Lumpsum", icon: "📈",
    tagline: "Watch your wealth compound",
    category: "invest", color: "#00d09c",
    component: SIPCalc,
  },
  {
    id: "fd", label: "FD / RD", icon: "🏦",
    tagline: "Safe, steady, guaranteed",
    category: "invest", color: "#00d09c",
    component: FDCalc,
  },
  {
    id: "ppf", label: "PPF Calculator", icon: "💜",
    tagline: "Tax-free 7.1% — the gold standard",
    category: "invest", color: "#8b5cf6",
    component: PPFCalc,
  },
  {
    id: "fire", label: "FIRE Planner", icon: "🔥",
    tagline: "Find your retirement number",
    category: "plan", color: "#f97316",
    component: FIRECalc,
  },
  {
    id: "ctc", label: "Salary / CTC", icon: "💼",
    tagline: "Negotiate smarter, take home more",
    category: "plan", color: "#6366f1",
    component: CTCCalc,
  },
];

const CATEGORIES = [
  { id: "all",    label: "All",     icon: "⚡" },
  { id: "borrow", label: "Borrow",  icon: "🏠" },
  { id: "invest", label: "Invest",  icon: "📈" },
  { id: "plan",   label: "Plan",    icon: "🎯" },
];

// ── Home Screen ────────────────────────────────────────────────────────────────
function HomeScreen({ onSelect }) {
  const [cat, setCat] = useState("all");
  const [showNotify, setShowNotify] = useState(false);
  const filtered = cat === "all" ? CALCULATORS : CALCULATORS.filter(c => c.category === cat);

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Hero */}
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1.2 }}>
          Your money,<br />
          <span style={{ background: "linear-gradient(90deg, #00d09c, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            calculated.
          </span>
        </div>
        <div style={{ color: "#64748b", fontSize: 13, marginTop: 8, fontFamily: "DM Sans, sans-serif" }}>
          Free tools to plan, invest and negotiate smarter
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 8, padding: "20px 20px 0", overflowX: "auto" }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} style={{
            flexShrink: 0, padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer",
            background: cat === c.id ? "linear-gradient(135deg, #00d09c, #00b386)" : "#1e293b",
            color: cat === c.id ? "#fff" : "#64748b",
            fontSize: 12, fontWeight: 700, fontFamily: "Syne, sans-serif",
            transition: "all 0.2s",
            boxShadow: cat === c.id ? "0 2px 12px #00d09c33" : "none"
          }}>{c.icon} {c.label}</button>
        ))}
      </div>

      {/* Calculator cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "16px 20px 0" }}>
        {filtered.map(calc => (
          <button key={calc.id} onClick={() => onSelect(calc.id)} style={{
            background: "#111827", border: "1px solid #1e293b", borderRadius: 18,
            padding: "18px 16px", textAlign: "left", cursor: "pointer",
            transition: "all 0.2s", display: "flex", flexDirection: "column",
            gap: 0, minHeight: 160
          }}
          onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${calc.color}44`; e.currentTarget.style.background = "#161f2e"; }}
          onMouseLeave={e => { e.currentTarget.style.border = "1px solid #1e293b"; e.currentTarget.style.background = "#111827"; }}
          >
            <div style={{ fontSize: 26, marginBottom: 10 }}>{calc.icon}</div>
            <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, fontFamily: "Syne, sans-serif", lineHeight: 1.3, marginBottom: 6 }}>{calc.label}</div>
            <div style={{ color: "#475569", fontSize: 11, fontFamily: "DM Sans, sans-serif", lineHeight: 1.4, flex: 1 }}>{calc.tagline}</div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: calc.color, flexShrink: 0 }} />
              <span style={{ color: calc.color, fontSize: 10, fontWeight: 700, fontFamily: "Syne, sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>{calc.category}</span>
            </div>
          </button>
        ))}
      </div>

      {showNotify && <NotifyModal onClose={() => setShowNotify(false)} />}

      {/* Coming soon teaser */}
      <div style={{ margin: "16px 20px 0", background: "linear-gradient(135deg, #3b82f618, #6366f111)", border: "1px solid #3b82f633", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600, fontFamily: "Syne, sans-serif" }}>More calculators coming</div>
          <div style={{ color: "#64748b", fontSize: 11, marginTop: 2, fontFamily: "DM Sans, sans-serif" }}>Tax regime, NPS, Rent vs Buy & more</div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: "Syne, sans-serif", cursor: "pointer" }}>
          Notify Me
        </div>
      </div>
      {/* Home page ad slot */}
      <div style={{ padding: "0 20px" }}>
        <AdSlot position="banner" />
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function PaisaMarg() {
  const [activeId, setActiveId] = useState(null);
  const [emailModal, setEmailModal] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try { return !localStorage.getItem("pm_disclaimer_accepted"); }
    catch { return true; }
  });

  const acceptDisclaimer = () => {
    try { localStorage.setItem("pm_disclaimer_accepted", "1"); } catch {}
    setShowDisclaimer(false);
  };

  useEffect(() => {
    // Fonts
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap";
    document.head.appendChild(link);

    // PWA meta tags
    const metas = [
      { name: "theme-color", content: "#0a0f1e" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "PaisaMarg" },
      { name: "description", content: "Free personal finance calculators for India — EMI, SIP, PPF, FIRE, Salary and more." },
    ];
    metas.forEach(({ name, content: val }) => {
      const m = document.createElement("meta");
      m.name = name; m.content = val;
      document.head.appendChild(m);
    });
    // PWA manifest link
    const ml = document.createElement("link");
    ml.rel = "manifest"; ml.href = "/manifest.json";
    document.head.appendChild(ml);
    // Service worker registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    document.title = "PaisaMarg — Smart Money Calculators";
  }, []);

  const activeCalc = CALCULATORS.find(c => c.id === activeId);
  const CalcComponent = activeCalc?.component;

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e",
      backgroundImage: "radial-gradient(ellipse at 20% 0%, #00d09c18 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, #3b82f618 0%, transparent 60%)",
      fontFamily: "DM Sans, sans-serif", maxWidth: 480, margin: "0 auto"
    }}>

      {/* Header — always visible */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#0a0f1eee",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #1e293b",
        padding: "14px 20px",
        display: "flex", alignItems: "center", gap: 10
      }}>
        {activeId && (
          <button onClick={() => { setActiveId(null); setEmailModal(false); }} style={{
            background: "#1e293b", border: "none", borderRadius: 10,
            width: 34, height: 34, cursor: "pointer", color: "#94a3b8",
            fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0
          }}>←</button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #00d09c, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>₹</div>
          <div>
            <div style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>PaisaMarg</div>
            {activeId && <div style={{ color: "#64748b", fontSize: 10, fontFamily: "DM Sans, sans-serif" }}>{activeCalc?.label}</div>}
          </div>
        </div>
        {activeId && (
          <div style={{ fontSize: 22 }}>{activeCalc?.icon}</div>
        )}
      </div>

      {showDisclaimer && <GlobalDisclaimer onAccept={acceptDisclaimer} />}

      {/* Screen */}
      {!activeId
        ? <HomeScreen onSelect={setActiveId} />
        : (
          <div style={{ padding: "16px 20px 40px" }}>
            {emailModal && (
              <EmailModal
                onClose={() => setEmailModal(false)}
                subject={`My ${activeCalc?.label} — PaisaMarg`}
                body={`Hi,\n\nHere are my ${activeCalc?.label} results from PaisaMarg.\n\nVisit https://paisamarg.in to recalculate.\n\n— PaisaMarg`}
                source={activeId}
              />
            )}
            {/* Calc header */}
            <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{activeCalc?.label}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 3, fontFamily: "DM Sans, sans-serif" }}>{activeCalc?.tagline}</div>
              </div>
              <button onClick={() => setEmailModal(true)} style={{
                flexShrink: 0, background: "#1e293b", border: "1px solid #334155", borderRadius: 10,
                padding: "8px 12px", cursor: "pointer", color: "#94a3b8",
                fontSize: 11, fontWeight: 700, fontFamily: "Syne, sans-serif",
                display: "flex", alignItems: "center", gap: 5, marginLeft: 10
              }}>📧 Email</button>
            </div>
            {/* Calculator card */}
            <div style={{ background: "#111827", borderRadius: 22, border: "1px solid #1e293b", padding: "22px 18px", boxShadow: "0 20px 60px #00000070" }}>
              {CalcComponent && <CalcComponent />}
            </div>
            {/* Ad slot — inline between calc and affiliate */}
            <AdSlot position="inline" />
            {/* Affiliate nudge */}
            <AffiliateNudge calcId={activeId} />
            {/* Per-calculator disclaimer */}
            <DisclaimerBar calcId={activeId} />
          </div>
        )
      }
    </div>
  );
}
