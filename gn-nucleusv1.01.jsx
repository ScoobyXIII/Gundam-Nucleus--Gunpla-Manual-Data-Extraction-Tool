import { useState, useRef, useEffect, useCallback } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700;900&display=swap');`;

const C = {
  bg: "#0a0c0f", bg1: "#0d1218", bg2: "#0f1520", bg3: "#141820", bg4: "#111a22",
  border: "#1a2530", border2: "#2a3a4a", border3: "#1e2a3a",
  text: "#e8f0f8", textMid: "#c8d0d8", textDim: "#6a8090", textFaint: "#3a5060",
  blue: "#4a9eff", blueBg: "#0a1520", blueBorder: "#1a3050",
  amber: "#ffaa40", amberBg: "#1e1206", amberBorder: "#4a2c10",
  green: "#40cc80", greenBg: "#051510", greenBorder: "#0f3020",
  purple: "#a060ff", purpleBg: "#100820", purpleBorder: "#301a50",
  teal: "#40cccc", tealBg: "#051515", tealBorder: "#0f3030",
  red: "#ff6060", redBg: "#1a0f0f", redBorder: "#3a1515",
  warn: "#ff9040", warnBg: "#150e05", warnBorder: "#3a2010",
};

const MAT_COLORS = {
  PS:  { color: "#60b8ff", bg: "#041020",   border: "#0a2840" },
  ABS: { color: "#c8783a", bg: "#180c04",   border: "#341808" },
  PE:  { color: "#50e898", bg: "#021408",   border: "#063018" },
  PVC: { color: "#ff4466", bg: "#1a0410",   border: "#380820" },
  POM: { color: "#00e5e5", bg: "#021414",   border: "#043030" },
};

const mono = "'Share Tech Mono', monospace";
const cond = "'Barlow Condensed', sans-serif";

const SYSTEM_PROMPT = `You are a precise Gunpla manual data extraction assistant. Extract structured kit data from uploaded manual images and return ONLY raw JSON. No preamble, no markdown, no explanation.

NOTE: Images may be uploaded out of order. Use internal page numbers, step numbers, and unit numbers from within the images themselves to determine correct sequence — do not rely on image order.

Images may include:
1. Runner inventory pages - header format "[letter]パーツ (___樹脂：___)" near each runner image
2. An index/overview page - full kit diagram with numbered unit labels e.g. 《頭部》2, 《ボディ》1
3. Assembly instruction pages - step-by-step sequences; each step box has a unit number in its corner

Return this exact JSON structure:
{"unit_index":{"1":"BODY","2":"HEAD"},"runners":[{"label":"A","quantity":1,"material":"PS","runners":[{"parts":[{"num":"1","active":true},{"num":"2","active":true},{"num":"3","active":false}]}]}],"polycaps":[{"label":"PC","quantity":1}],"units":[{"name":"HEAD","unit_number":"2","note":null,"needs_review":false,"runners_used":["A","B"],"parts":[{"num":"A3","active":true},{"num":"A9","active":true},{"num":"B7","active":true}]}]}

needs_review: set to true when the unit appears to be a join, attachment, or continuation step. Signals: step contains bracketed references to completed units ([6]で作った, [8]で作った etc), very few new parts (1-3), step name or context implies attaching or joining rather than building. Even when needs_review:true, still extract all part callouts found in the step.

RUNNER LABEL RULES:
- Full label is unique identifier. Simple: "A","B". Numbered variants: "C1","C2" are SEPARATE runner entries.
- A physically duplicate runner (same runner included twice in the box) uses quantity:2 and has TWO entries in the runners array — one per physical runner. Parts may differ between them if one has unused parts.
- Polycaps (PC, PCA, PCB) always in polycaps array only, never in runners array.

MATERIAL RULES:
- Read "[letter]パーツ (___樹脂：___)" header. Extract text after colon.
- Only return: PS, ABS, PE, PVC, POM. Anything else: null. Never guess.

PARTS EXTRACTION RULES — CRITICAL:
- Enumerate EVERY individual circled part number visible on the runner image, one by one. Do NOT estimate ranges.
- active:false = part is crossed out, X-marked, or greyed out (unused for this kit variant).
- active:true = part is present and used.
- Sort parts numerically ascending within each runner entry.
- For duplicate runners: list parts separately for each physical runner. If both are identical, duplicate the parts array. If one has unused parts, mark those active:false in that runner's entry.

UNIT ASSEMBLY RULES — READ THIS CAREFULLY:
Bandai assembly pages contain several distinct visual regions. You must identify each correctly before extracting any part numbers.

STEP 1 — FIND ASSEMBLY BOXES:
- Assembly steps appear inside clearly bordered rectangular boxes.
- Each box has a unit number in its top-left corner, formatted as a bold number inside a square e.g. [1], [2], [7]. This is your grouping key.
- Some boxes also have a sub-step indicator below the unit number e.g. 〈1〉, 〈2〉 — these are sub-steps of the same unit, not separate units.
- Only extract parts from inside these bordered assembly boxes.

STEP 2 — IGNORE NON-ASSEMBLY CONTENT:
- Some pages contain a cutting tutorial section showing how to remove parts from sprues. This section contains standalone circled numbers (1, 2) with NO letter prefix. These are step indicators, NOT part numbers. IGNORE entirely.
- Page numbers, safety warnings, legend icons, and watermarks are not parts. IGNORE.

STEP 3 — READ ALL CALLOUTS WITHIN AN ASSEMBLY BOX:
- Every part callout inside an assembly box must be captured, including those inside inset detail views or alternate-angle callouts within the same box. These are supplemental views of the same step — they contain unique parts, not duplicates.
- Dashed pointer lines and arrows are just visual guides. Ignore the lines themselves, read only the labels they point to.
- A valid part callout is always a letter followed by a number e.g. A3, B7, H12, PCc, PCA. Never a standalone number.
- If a part appears multiple times in the same unit across multiple sub-steps, list it once with a count: A3(x2).

STEP 4 — GROUP BY UNIT NUMBER:
- Collect all parts from all sub-steps of the same unit number into one unit entry.
- Use unit_index to name the unit. If no index page provided, infer from part types and assembled shape.
- L/R identical parts: note "L/R identical", list once. If L and R differ: separate unit entries.
- runners_used: derive from active parts, letter prefix only.

STEP 5 — HANDLE JOIN STEPS AND UNIT CONTINUATIONS:
- Some steps are pure join steps — they show completed subassemblies being combined with NO new letter-prefixed part callouts. You will see bracketed references like [6]で作った腰部 (waist built in step 6) or [8]で作った右脚 (right leg built in step 8). If a step contains ONLY these references and no new part callouts, SKIP IT — do not create a unit entry for it.
- Some steps are hybrid — they show completed units being joined BUT also introduce new parts. In this case, look for which bracketed completed-unit reference the new parts are physically closest to or pointing toward. Assign those new parts to that existing unit, not to a new unit named after the current step number.
- Example: step 10 shows [6] waist + [8] right leg + [9] left leg being joined, with new parts B1 and B6 attaching to the waist. B1 and B6 belong to the WAIST unit (6), not to a new unit 10.
- Index dot notation like 7·8 = RIGHT LEG means step 8 is a continuation of unit 7. Parts from step 8 fold into the RIGHT LEG unit, not a separate unit. Similarly 7·9 = LEFT LEG means step 9 folds into LEFT LEG.

UNIT INDEX: 頭部=HEAD,ボディ=BODY,胴部=TORSO,腰部=WAIST,右腕=RIGHT ARM,左腕=LEFT ARM,右脚=RIGHT LEG,左脚=LEFT LEG,ライフル=BEAM RIFLE,シールド=SHIELD. If no index page: {}.

GENERAL: Do not guess. If a callout is unclear, omit it rather than fabricate.`;

const RETRY_PROMPT = `Extract data for ONE Gunpla assembly unit from these manual pages. Return ONLY a raw JSON object, no array wrapper.
{"name":"RIGHT ARM","unit_number":"3","note":null,"runners_used":["A","C"],"parts":[{"num":"A3","active":true},{"num":"A9","active":true},{"num":"C2","active":true},{"num":"PC(x2)","active":true}]}

READING HIERARCHY:
1. Find bordered assembly boxes only — these are your scope. Ignore everything outside them.
2. Read the unit number from the bold square in the top-left corner of each box — this is your grouping key.
3. Extract ALL part callouts within the box including inset detail views — they contain unique parts, not duplicates.
4. A valid callout is always letter + number: A3, B7, H12, PCc. Standalone numbers without a letter prefix are step indicators — ignore them.
5. Dashed lines and arrows are guides only — read the labels, not the lines.
6. If a part appears across multiple sub-steps of the same unit, list once with count: A3(x2).
parts: active:true for all. runners_used: letter prefix only. Do not guess. If unclear omit.`;

async function callClaude(images, prompt, isRetry) {
  const imageContents = await Promise.all(images.map(async (img) => {
    const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(img); });
    return { type: "image", source: { type: "base64", media_type: img.type, data: base64 } };
  }));
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 16000, system: isRetry ? RETRY_PROMPT : SYSTEM_PROMPT, messages: [{ role: "user", content: [...imageContents, { type: "text", text: prompt }] }] }),
  });
  const data = await response.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message}\n\nRaw response (last 300 chars):\n...${clean.slice(-300)}`);
  }
}

// Sort files by numeric value in filename
function sortFilesByName(files) {
  return [...files].sort((a, b) => {
    const na = parseInt((a.name.match(/\d+/) || ["0"])[0]);
    const nb = parseInt((b.name.match(/\d+/) || ["0"])[0]);
    return na - nb;
  });
}

function activeParts(parts) { return (parts || []).filter(p => p.active); }
function runnerTotal(parts) { return activeParts(parts).length; }
function runnerRange(parts) {
  const nums = (parts || []).map(p => parseInt(p.num)).filter(n => !isNaN(n));
  if (!nums.length) return "—";
  return `${Math.min(...nums)}–${Math.max(...nums)}`;
}
function sortParts(parts) { return [...parts].sort((a, b) => { const na = parseInt(a.num), nb = parseInt(b.num); return isNaN(na) || isNaN(nb) ? 0 : na - nb; }); }

function buildText(kit) {
  const L = [];
  L.push(kit.name || "Unnamed Kit");
  const m = [kit.brand, kit.grade, kit.scale, kit.mfgDate].filter(Boolean).join(" · ");
  if (m) L.push(m); L.push("");
  const t = (kit.runners?.reduce((s, r) => s + (r.quantity || 1), 0) || 0) + (kit.polycaps?.reduce((s, p) => s + (p.quantity || 1), 0) || 0);
  L.push(`RUNNERS: ${t}`); L.push("");
  kit.runners?.forEach(r => {
    L.push(`${r.label}${r.quantity > 1 ? ` (x${r.quantity})` : ""}`);
    if (r.material) L.push(`  MATERIAL: ${r.material}`);
    (r.runners || [{}]).forEach((sub, i) => {
      const parts = sub.parts || [];
      const ap = activeParts(parts);
      if (r.quantity > 1) L.push(`  Runner ${i + 1}:`);
      L.push(`  RANGE: ${runnerRange(parts)}  TOTAL: ${ap.length}`);
    });
    L.push("");
  });
  kit.polycaps?.forEach(p => { L.push(`${p.label}(x${p.quantity || 1}) - POLYCAP`); L.push(""); });
  if (kit.units?.length) {
    L.push("-----------------"); L.push("UNITS"); L.push("-----------------"); L.push("");
    kit.units.forEach(u => {
      const ap = activeParts(u.parts || []);
      L.push(`${u.name}${u.note ? ` (${u.note})` : ""}`);
      L.push(`  Total Parts: ${ap.length} | Runners: ${u.runners_used?.join(", ")}`);
      L.push(`  ${ap.map(p => p.num).join(", ")}`); L.push("");
    });
  }
  return L.join("\n");
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: 6, padding: "20px 24px", maxWidth: 320, width: "90%" }}>
        <div style={{ fontSize: 13, fontFamily: mono, color: C.textMid, marginBottom: 18, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "6px 14px", fontSize: 11, cursor: "pointer", color: C.textDim, background: "none", border: `1px solid ${C.border3}`, borderRadius: 3, fontFamily: mono }}>CANCEL</button>
          <button onClick={onConfirm} style={{ padding: "6px 14px", fontSize: 11, cursor: "pointer", color: C.red, background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 3, fontFamily: mono }}>DELETE</button>
        </div>
      </div>
    </div>
  );
}

// ── Part Circle ────────────────────────────────────────────────────────────
function PartCircle({ part, onToggle, onDuplicate, onDragStart, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(part.num);
  const inputRef = useRef();
  const rcTimer = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (rcTimer.current) {
      clearTimeout(rcTimer.current);
      rcTimer.current = null;
      onDelete();
    } else {
      rcTimer.current = setTimeout(() => {
        rcTimer.current = null;
        setVal(part.num);
        setEditing(true);
      }, 140);
    }
  };

  const commit = () => {
    setEditing(false);
    if (val.trim() && val.trim() !== part.num) onEdit(val.trim());
    else setVal(part.num);
  };

  if (editing) return (
    <input
      ref={inputRef}
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(part.num); setEditing(false); } }}
      onBlur={commit}
      style={{ width: 38, height: 38, borderRadius: "50%", border: `1.5px solid ${C.blue}`, background: C.blueBg, color: C.blue, fontFamily: mono, fontSize: 11, textAlign: "center", outline: "none", flexShrink: 0 }}
    />
  );

  return (
    <div
      onClick={onToggle}
      onDoubleClick={e => { e.stopPropagation(); onDuplicate(); }}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={onDragStart}
      title="Click: toggle | Dbl-click: duplicate | Right-click: edit | Dbl-right-click: delete | Drag: delete"
      style={{
        width: 38, height: 38, borderRadius: "50%",
        border: `1.5px solid ${part.active ? C.border2 : C.border}`,
        background: part.active ? C.bg3 : C.bg1,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", userSelect: "none", fontFamily: mono, fontSize: 11,
        color: part.active ? C.text : C.textFaint,
        transition: "all 0.15s",
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = part.active ? C.blue : C.border2; e.currentTarget.style.color = C.text; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = part.active ? C.border2 : C.border; e.currentTarget.style.color = part.active ? C.text : C.textFaint; }}
    >{part.num}</div>
  );
}

function AddPartCircle({ onAdd, nextNum }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const ref = useRef();
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);
  const commit = () => { if (val.trim()) onAdd(val.trim()); setVal(""); setEditing(false); };
  if (!editing) return (
    <div
      onClick={() => { if (nextNum != null) onAdd(String(nextNum)); else setEditing(true); }}
      onContextMenu={e => { e.preventDefault(); setEditing(true); }}
      title={nextNum != null ? `Click: add ${nextNum} · Right-click: custom` : "Add part"}
      style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px dashed ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.textFaint, fontSize: 18, flexShrink: 0 }}>+</div>
  );
  return <input ref={ref} value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(""); setEditing(false); } }} onBlur={commit} style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${C.blue}`, background: C.blueBg, color: C.blue, fontFamily: mono, fontSize: 11, textAlign: "center", outline: "none", flexShrink: 0 }} />;
}

// ── Sub-runner edit (part circles + trash) ─────────────────────────────────
function SubRunnerEdit({ parts, onChange }) {
  const [dragging, setDragging] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverTrash, setDragOverTrash] = useState(false);

  const toggle = (i) => { const n = [...parts]; n[i] = { ...n[i], active: !n[i].active }; onChange(n); };
  const dupe = (i) => { const n = [...parts]; n.splice(i + 1, 0, { ...parts[i], active: true }); onChange(sortParts(n)); };
  const del = (i) => onChange(parts.filter((_, idx) => idx !== i));
  const add = (num) => onChange(sortParts([...parts, { num, active: true }]));

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "8px 0" }}>
        {parts.map((p, i) => (
          <PartCircle key={i} part={p} onToggle={() => toggle(i)} onDuplicate={() => dupe(i)}
            onEdit={(num) => { const n = [...parts]; n[i] = { ...n[i], num }; onChange(sortParts(n)); }}
            onDelete={() => del(i)}
            onDragStart={e => { setDragging(true); setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }} />
        ))}
        <AddPartCircle onAdd={add} nextNum={(() => { const nums = parts.map(p => parseInt(p.num)).filter(n => !isNaN(n)); return nums.length ? Math.max(...nums) + 1 : null; })()} />
      </div>
      {dragging && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOverTrash(true); }}
          onDragLeave={() => setDragOverTrash(false)}
          onDrop={e => { e.preventDefault(); if (dragIdx !== null) del(dragIdx); setDragOverTrash(false); setDragging(false); setDragIdx(null); }}
          onDragEnd={() => { setDragging(false); setDragIdx(null); setDragOverTrash(false); }}
          style={{ padding: "8px", border: `1.5px dashed ${dragOverTrash ? C.red : C.border2}`, borderRadius: 4, textAlign: "center", fontFamily: mono, fontSize: 11, color: dragOverTrash ? C.red : C.textFaint, background: dragOverTrash ? C.redBg : "transparent", transition: "all 0.1s", marginBottom: 4 }}>
          {dragOverTrash ? "release to delete" : "drag here to delete"}
        </div>
      )}
    </div>
  );
}

// ── Material Picker ────────────────────────────────────────────────────────
function MaterialPicker({ material, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef();
  const mat = material ? MAT_COLORS[material] : null;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(v => !v);
  };

  return (
    <span ref={triggerRef} style={{ position: "relative" }}>
      <span onClick={handleOpen} style={{ fontSize: 10, padding: "2px 6px", border: `1px solid ${mat ? mat.border : C.border3}`, borderRadius: 3, color: mat ? mat.color : C.textFaint, background: mat ? mat.bg : C.bg2, cursor: "pointer", fontFamily: mono, userSelect: "none", display: "inline-block" }}>
        {material || "MAT?"}
      </span>
      {open && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, background: "#0f1520", border: `1px solid ${C.border2}`, borderRadius: 4, zIndex: 9999, overflow: "hidden", minWidth: 80, boxShadow: "0 4px 16px rgba(0,0,0,0.6)" }}>
          {["PS","ABS","PE","PVC","POM"].map(m => {
            const mc = MAT_COLORS[m];
            return (
              <div key={m} onClick={e => { e.stopPropagation(); onChange(m); setOpen(false); }}
                style={{ padding: "6px 12px", cursor: "pointer", fontFamily: mono, fontSize: 11, color: mc.color, background: "transparent" }}
                onMouseEnter={e => e.currentTarget.style.background = mc.bg}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >{m}</div>
            );
          })}
          <div onClick={e => { e.stopPropagation(); onChange(null); setOpen(false); }}
            style={{ padding: "6px 12px", cursor: "pointer", fontFamily: mono, fontSize: 11, color: C.textFaint, borderTop: `1px solid ${C.border}` }}
            onMouseEnter={e => e.currentTarget.style.color = C.textMid}
            onMouseLeave={e => e.currentTarget.style.color = C.textFaint}
          >clear</div>
        </div>
      )}
    </span>
  );
}

// ── Runner Card ────────────────────────────────────────────────────────────
function RunnerCard({ runner, onUpdate, onDuplicate, onDelete, isExpanded, onToggleExpand, onDragStart, onDragEnd }) {
  const [subExpanded, setSubExpanded] = useState({});
  const [confirm, setConfirm] = useState(false);
  const cardRef = useRef();
  const rcTimers = useRef({});
  const [subUndoStacks, setSubUndoStacks] = useState({}); // keyed by sub-runner index
  const cardRcTimer = useRef(null);
  const dupClickRef = useRef(false);

  const expanded = isExpanded;
  const subRunners = runner.runners || [{ parts: [] }];
  const hasDup = subRunners.length > 1;

  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        let bestIdx = -1, bestLen = 0;
        Object.entries(subUndoStacks).forEach(([k, v]) => { if (v.length > bestLen) { bestLen = v.length; bestIdx = Number(k); } });
        if (bestIdx === -1) return;
        e.preventDefault();
        e.stopPropagation();
        setSubUndoStacks(s => {
          const stack = s[bestIdx] || [];
          if (!stack.length) return s;
          const prev = stack[stack.length - 1];
          const next = [...subRunners]; next[bestIdx] = { ...next[bestIdx], parts: prev };
          onUpdate({ ...runner, _id: runner._id, runners: next });
          return { ...s, [bestIdx]: stack.slice(0, -1) };
        });
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [expanded, runner, onUpdate, subUndoStacks, subRunners]);

  const pushSubUndo = (i) => setSubUndoStacks(s => ({ ...s, [i]: [...(s[i] || []).slice(-9), subRunners[i].parts] }));
  const undoSub = (e, i) => {
    e.stopPropagation();
    setSubUndoStacks(s => {
      const stack = s[i] || [];
      if (!stack.length) return s;
      const prev = stack[stack.length - 1];
      const next = [...subRunners]; next[i] = { ...next[i], parts: prev };
      onUpdate({ ...runner, _id: runner._id, runners: next });
      return { ...s, [i]: stack.slice(0, -1) };
    });
  };

  const updateSub = (idx, parts) => {
    pushSubUndo(idx);
    const next = [...subRunners]; next[idx] = { ...next[idx], parts };
    onUpdate({ ...runner, _id: runner._id, runners: next });
  };
  const addDuplicate = (e) => {
    e.stopPropagation();
    if (subRunners.length >= 8) return;
    const copy = { parts: [...(subRunners[0].parts || []).map(p => ({ ...p }))] };
    onUpdate({ ...runner, _id: runner._id, quantity: subRunners.length + 1, runners: [...subRunners, copy] });
  };
  const updateLabel = (val) => onUpdate({ ...runner, _id: runner._id, label: val });
  const updateMaterial = (val) => onUpdate({ ...runner, _id: runner._id, material: val || null });

  return (
    <>
      {confirm && <ConfirmDialog message={`Delete runner ${runner.label}?`} onConfirm={() => { setConfirm(false); onDelete(); }} onCancel={() => setConfirm(false)} />}
      <div ref={cardRef} style={{
        background: C.bg1,
        border: `1px solid ${expanded ? C.border2 : C.border}`,
        borderRadius: 6,
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: expanded ? `0 0 0 1px ${C.border2}, 0 4px 24px rgba(0,0,0,0.4)` : "none",
        cursor: expanded ? "default" : "default",
      }}
        onDoubleClick={!expanded ? (e => { const tag = e.target.tagName; if (tag === "BUTTON" || tag === "INPUT") return; e.preventDefault(); onDuplicate(); }) : undefined}
        onContextMenu={!expanded ? (e => { e.preventDefault(); if (cardRcTimer.current) { clearTimeout(cardRcTimer.current); cardRcTimer.current = null; setConfirm(true); } else { cardRcTimer.current = setTimeout(() => { cardRcTimer.current = null; }, 200); } }) : undefined}
        draggable={!expanded}
        onDragStart={!expanded ? onDragStart : undefined}
        onDragEnd={!expanded ? onDragEnd : undefined}
        title={!expanded ? "Dbl-click: duplicate · Dbl-right-click: delete · Drag to trash" : undefined}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.borderColor = C.border2; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.borderColor = C.border; }}
      >

        {/* Header — always visible, clickable to collapse when expanded */}
        <div
          onClick={expanded ? () => onToggleExpand(runner._id) : undefined}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: expanded ? "6px 8px" : "5px 8px 5px 6px",
            borderBottom: expanded ? `1px solid ${C.border}` : "none",
            cursor: expanded ? "pointer" : "default",
            userSelect: "none",
          }}
          onMouseEnter={e => { if (expanded) e.currentTarget.style.background = C.bg3; }}
          onMouseLeave={e => { if (expanded) e.currentTarget.style.background = "transparent"; }}
        >
          {/* Left: label + quantity */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }} onClick={e => { if (expanded) e.stopPropagation(); }}>
            {expanded
              ? <input value={runner.label} onChange={e => updateLabel(e.target.value)} onClick={e => e.stopPropagation()} style={{ width: 42, background: C.bg2, border: `1px solid ${C.blue}`, color: C.text, fontFamily: mono, fontSize: 14, outline: "none", borderRadius: 3, padding: "1px 4px" }} />
              : <button
                  onClick={e => { e.stopPropagation(); onToggleExpand(runner._id); }}
                  onDoubleClick={e => e.stopPropagation()}
                  style={{
                    fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.text,
                    background: C.bg3, border: `1px solid ${C.border2}`,
                    borderRadius: 4, padding: "3px 10px", cursor: "pointer",
                    letterSpacing: "0.04em",
                    transition: "transform 0.07s, background 0.07s, box-shadow 0.07s",
                    boxShadow: `0 2px 0 ${C.border}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.bg4; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.bg3; e.currentTarget.style.boxShadow = `0 2px 0 ${C.border}`; e.currentTarget.style.transform = "translateY(0)"; }}
                  onMouseDown={e => { e.currentTarget.style.transform = "translateY(2px)"; e.currentTarget.style.boxShadow = "none"; }}
                  onMouseUp={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 2px 0 ${C.border}`; }}
                >{runner.label}</button>
            }
            {hasDup && (
              <span style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: C.textFaint }}>×</span>
                <span style={{ fontFamily: mono, fontSize: 9, color: C.blue, fontWeight: 700 }}>{subRunners.length}</span>
              </span>
            )}
          </div>
          {/* Right: material chip */}
          <span onClick={e => e.stopPropagation()}>
            <MaterialPicker material={runner.material} onChange={updateMaterial} />
          </span>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div
            style={{ padding: "10px 13px", userSelect: "none" }}
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => {
              const tag = e.target.tagName;
              if (tag === "BUTTON" || tag === "INPUT") return;
              e.preventDefault();
              e.stopPropagation();
              if (subRunners.length < 8) addDuplicate(e);
            }}
          >
            <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
              <button onClick={addDuplicate} disabled={subRunners.length >= 8} style={{ fontSize: 10, padding: "2px 7px", cursor: subRunners.length >= 8 ? "not-allowed" : "pointer", color: subRunners.length >= 8 ? C.textFaint : C.textDim, background: "none", border: `1px solid ${subRunners.length >= 8 ? C.border : C.border}`, borderRadius: 3, fontFamily: mono, opacity: subRunners.length >= 8 ? 0.4 : 1 }}>
                {subRunners.length >= 8 ? "MAX (8)" : `+ DUPLICATE RUNNER (${subRunners.length}/8)`}
              </button>
              <button onClick={(e) => { e.stopPropagation(); setConfirm(true); }} style={{ fontSize: 10, padding: "2px 7px", cursor: "pointer", color: C.red, background: "none", border: `1px solid ${C.redBorder}`, borderRadius: 3, fontFamily: mono }}>DELETE</button>
            </div>

            {subRunners.map((sub, i) => {
              const ap = activeParts(sub.parts || []);
              const isExtra = i > 0;
              const showParts = !isExtra || subExpanded[i];
              return (
                <div key={i}>
                  {isExtra && (
                    <div
                      onDoubleClick={e => { e.preventDefault(); e.stopPropagation(); if (subRunners.length < 8) addDuplicate(e); }}
                      style={{ margin: "10px 0 6px" }}
                    >
                      {(() => {
                        const handleRC = (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (rcTimers.current[i]) {
                            clearTimeout(rcTimers.current[i]);
                            rcTimers.current[i] = null;
                            pushSubUndo(i);
                            onUpdate({ ...runner, quantity: subRunners.length - 1, runners: subRunners.filter((_, idx) => idx !== i) });
                          } else {
                            rcTimers.current[i] = setTimeout(() => { rcTimers.current[i] = null; }, 140);
                          }
                        };
                        return (<>
                          <div onClick={() => setSubExpanded(s => ({ ...s, [i]: !s[i] }))} onContextMenu={handleRC} style={{ width: "40%", height: 1, background: C.border, marginBottom: 8, cursor: "pointer" }} />
                          <div
                            onClick={subExpanded[i] ? () => setSubExpanded(s => ({ ...s, [i]: !s[i] })) : undefined}
                            onContextMenu={subExpanded[i] ? handleRC : undefined}
                            style={{ display: "flex", alignItems: "center", justifyContent: subExpanded[i] ? "space-between" : "flex-start", gap: 8, fontFamily: mono, fontSize: 10, color: C.textDim, cursor: subExpanded[i] ? "pointer" : "default" }}
                          >
                            <span
                              onClick={!subExpanded[i] ? () => setSubExpanded(s => ({ ...s, [i]: !s[i] })) : undefined}
                              onContextMenu={!subExpanded[i] ? handleRC : undefined}
                              style={{ color: C.textFaint, letterSpacing: "0.08em", cursor: "pointer" }}
                            >{`RUNNER ${i + 1}`}</span>
                            <div
                              onClick={!subExpanded[i] ? () => setSubExpanded(s => ({ ...s, [i]: !s[i] })) : undefined}
                              onContextMenu={!subExpanded[i] ? handleRC : undefined}
                              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                            >
                              {(subUndoStacks[i]?.length > 0) && <button onClick={e => { e.stopPropagation(); undoSub(e, i); }} style={{ fontSize: 10, padding: "1px 6px", cursor: "pointer", color: C.amber, background: "none", border: `1px solid ${C.amberBorder}`, borderRadius: 3, fontFamily: mono }}>↩</button>}
                              <span style={{ color: C.textFaint }}>Range</span>
                              <span>{runnerRange(sub.parts || [])}</span>
                              <span style={{ color: C.textFaint, marginLeft: 4 }}>Total</span>
                              <span>{ap.length}</span>
                              <span style={{ color: C.textFaint, transform: subExpanded[i] ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▾</span>
                              <button onClick={e => { e.stopPropagation(); pushSubUndo(i); onUpdate({ ...runner, quantity: subRunners.length - 1, runners: subRunners.filter((_, idx) => idx !== i) }); }}
                                style={{ fontSize: 10, padding: "1px 6px", cursor: "pointer", color: C.red, background: "none", border: `1px solid ${C.redBorder}`, borderRadius: 3, fontFamily: mono }}>✕</button>
                            </div>
                          </div>
                        </>);
                      })()}
                    </div>
                  )}
                  {!isExtra && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: C.textFaint, letterSpacing: "0.08em" }}>{hasDup ? `RUNNER ${i + 1}` : ""}</span>
                      <div style={{ display: "flex", gap: 8, fontFamily: mono, fontSize: 10, color: C.textDim, alignItems: "center" }}>
                        {(subUndoStacks[i]?.length > 0) && <button onClick={e => undoSub(e, i)} style={{ fontSize: 10, padding: "1px 6px", cursor: "pointer", color: C.amber, background: "none", border: `1px solid ${C.amberBorder}`, borderRadius: 3, fontFamily: mono }}>↩</button>}
                        <span style={{ color: C.textFaint }}>Range</span>
                        <span>{runnerRange(sub.parts || [])}</span>
                        <span style={{ color: C.textFaint, marginLeft: 4 }}>Total</span>
                        <span>{ap.length}</span>
                      </div>
                    </div>
                  )}
                  {showParts && <SubRunnerEdit parts={sub.parts || []} onChange={pts => updateSub(i, pts)} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── Review Overlay ─────────────────────────────────────────────────────────
function ReviewOverlay({ unit, units, onAssign, onAssignPart, onDismiss, onUndismiss, onClose }) {
  const [draggingPart, setDraggingPart] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const targets = units.filter(u => !u.needs_review && u.name !== unit.name);
  const parts = activeParts(unit.parts || []);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "22px 24px", maxWidth: 520, width: "100%" }}>
        {unit._dismissed && (
          <div style={{ marginBottom: 14 }}>
            <button onClick={onUndismiss} style={{ fontSize: 11, padding: "5px 12px", cursor: "pointer", color: C.warn, background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 3, fontFamily: mono }}>↑ SEND TO TOP</button>
          </div>
        )}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.warn, fontFamily: mono, letterSpacing: "0.05em", marginBottom: 4 }}>⚠ NEEDS REVIEW</div>
          <div style={{ fontSize: 12, color: C.textMid, fontFamily: mono, marginBottom: 2 }}>{unit.name}</div>
          <div style={{ fontSize: 11, color: C.textFaint, fontFamily: mono, marginBottom: 16 }}>
            Drag parts individually to a unit, or click a unit to assign all at once.
          </div>
        </div>
        {parts.length > 0 && (
          <div style={{ marginBottom: 16, padding: "8px 12px", background: C.bg1, borderRadius: 4, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.textFaint, fontFamily: mono, letterSpacing: "0.08em", marginBottom: 6 }}>PARTS TO ASSIGN</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {parts.map((p, i) => (
                <span
                  key={i}
                  draggable
                  onDragStart={e => { setDraggingPart(p); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { setDraggingPart(null); setDragOverTarget(null); }}
                  style={{
                    padding: "2px 8px", borderRadius: 3, fontFamily: mono, fontSize: 11, cursor: "grab", userSelect: "none",
                    border: `1px solid ${draggingPart === p ? C.blue : C.border2}`,
                    background: draggingPart === p ? C.blueBg : C.bg3,
                    color: draggingPart === p ? C.blue : C.textMid,
                    opacity: draggingPart && draggingPart !== p ? 0.4 : 1,
                    transition: "all 0.1s",
                  }}
                >{p.num}</span>
              ))}
            </div>
          </div>
        )}
        <div style={{ fontSize: 10, color: C.textFaint, fontFamily: mono, letterSpacing: "0.08em", marginBottom: 10 }}>ASSIGN TO</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
          {targets.map((t, i) => (
            <div key={i}
              onClick={() => onAssign(t)}
              onDragOver={e => { e.preventDefault(); setDragOverTarget(t); }}
              onDragLeave={() => setDragOverTarget(null)}
              onDrop={e => { e.preventDefault(); if (draggingPart) onAssignPart(draggingPart, t); setDraggingPart(null); setDragOverTarget(null); }}
              style={{
                padding: "12px 14px", background: C.bg3, borderRadius: 6, cursor: "pointer", transition: "all 0.12s",
                border: `1px solid ${dragOverTarget === t ? C.blue : C.border2}`,
                background: dragOverTarget === t ? C.blueBg : C.bg3,
              }}
              onMouseEnter={e => { if (!draggingPart) e.currentTarget.style.borderColor = C.blue; }}
              onMouseLeave={e => { if (!draggingPart) e.currentTarget.style.borderColor = C.border2; }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>{t.name}</div>
              <div style={{ fontSize: 10, color: C.textFaint, fontFamily: mono }}>{activeParts(t.parts || []).length} parts</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onDismiss} style={{ fontSize: 11, padding: "6px 14px", cursor: "pointer", color: C.textDim, background: "none", border: `1px solid ${C.border3}`, borderRadius: 3, fontFamily: mono }}>KEEP AS-IS</button>
        </div>
      </div>
    </div>
  );
}

// ── Unit Chip ──────────────────────────────────────────────────────────────
function UnitChip({ part, onToggle, onDuplicate, onDragStart, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(part.num);
  const inputRef = useRef();
  const rcTimer = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (rcTimer.current) {
      clearTimeout(rcTimer.current);
      rcTimer.current = null;
      onDelete();
    } else {
      rcTimer.current = setTimeout(() => { rcTimer.current = null; setVal(part.num); setEditing(true); }, 140);
    }
  };

  const commit = () => { setEditing(false); if (val.trim() && val.trim() !== part.num) onEdit(val.trim()); else setVal(part.num); };

  if (editing) return (
    <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(part.num); setEditing(false); } }}
      onBlur={commit}
      style={{ padding: "3px 9px", borderRadius: 3, border: `1px solid ${C.blue}`, background: C.blueBg, color: C.blue, fontFamily: mono, fontSize: 11, outline: "none", width: 64 }} />
  );

  return (
    <div onClick={onToggle} onDoubleClick={e => { e.stopPropagation(); onDuplicate(); }} onContextMenu={handleContextMenu} draggable onDragStart={onDragStart}
      title="Click: toggle | Dbl-click: duplicate | Right-click: edit | Dbl-right-click: delete | Drag: delete"
      style={{ padding: "3px 9px", borderRadius: 3, border: `1px solid ${part.active ? C.border2 : C.border}`, background: part.active ? C.bg3 : C.bg1, color: part.active ? C.textMid : C.textFaint, fontFamily: mono, fontSize: 11, cursor: "pointer", userSelect: "none", transition: "all 0.12s", flexShrink: 0 }}>
      {part.num}
    </div>
  );
}

function AddUnitChip({ onAdd }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const ref = useRef();
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);
  const commit = () => { if (val.trim()) onAdd(val.trim()); setVal(""); setEditing(false); };
  if (!editing) return <div onClick={() => setEditing(true)} style={{ padding: "3px 9px", borderRadius: 3, border: `1px dashed ${C.border2}`, color: C.textFaint, fontSize: 11, cursor: "pointer" }}>+</div>;
  return <input ref={ref} value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(""); setEditing(false); } }} onBlur={commit} style={{ padding: "3px 9px", borderRadius: 3, border: `1px solid ${C.blue}`, background: C.blueBg, color: C.blue, fontFamily: mono, fontSize: 11, outline: "none", width: 64 }} />;
}

// ── Unit Card ──────────────────────────────────────────────────────────────
function UnitCard({ unit, onUpdate, onDelete, onRetry, onReview, isExpanded, onToggleExpand, onUndismiss, onDuplicate, onDragStart, onDragEnd }) {
  const expanded = isExpanded;
  const [editingName, setEditingName] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [nameVal, setNameVal] = useState(unit.name);
  const [noteVal, setNoteVal] = useState(unit.note || "");
  const [showRetry, setShowRetry] = useState(false);
  const [retryFiles, setRetryFiles] = useState([]);
  const rcTimer = useRef(null);
  const [retryName, setRetryName] = useState(unit.name);
  const [retrying, setRetrying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const nameRef = useRef();
  const noteRef = useRef();
  const dupClickRef = useRef(false);

  useEffect(() => { if (editingName && nameRef.current) nameRef.current.focus(); }, [editingName]);
  useEffect(() => { if (editingNote && noteRef.current) noteRef.current.focus(); }, [editingNote]);

  const parts = unit.parts || [];
  const ap = activeParts(parts);
  const inferRunners = (pts) => { const s = new Set(pts.filter(p => p.active).map(p => p.num.match(/^([A-Z]+\d*)/)?.[1]).filter(Boolean)); return [...s].sort(); };

  const toggle = (i) => { const n = [...parts]; n[i] = { ...n[i], active: !n[i].active }; onUpdate({ ...unit, parts: n, runners_used: inferRunners(n) }); };
  const dupe = (i) => { const n = [...parts]; n.splice(i + 1, 0, { ...parts[i], active: true }); onUpdate({ ...unit, parts: n, runners_used: inferRunners(n) }); };
  const del = (i) => { const n = parts.filter((_, idx) => idx !== i); onUpdate({ ...unit, parts: n, runners_used: inferRunners(n) }); };
  const add = (num) => { const n = [...parts, { num, active: true }]; onUpdate({ ...unit, parts: n, runners_used: inferRunners(n) }); };

  const commitName = () => { setEditingName(false); if (nameVal.trim()) onUpdate({ ...unit, name: nameVal.trim() }); else setNameVal(unit.name); };
  const commitNote = () => { setEditingNote(false); onUpdate({ ...unit, note: noteVal.trim() || null }); };

  const collapseCard = () => { onToggleExpand(); setShowRetry(false); setEditingName(false); setEditingNote(false); };

  const doRetry = async () => {
    if (!retryFiles.length) return; setRetrying(true);
    try { const r = await callClaude(retryFiles, `Extract assembly data for unit "${retryName}". Return a single unit JSON object.`, true); onRetry({ ...r, name: retryName || r.name }); setShowRetry(false); setRetryFiles([]); onToggleExpand(); }
    catch (e) { alert("Retry failed: " + e.message); } finally { setRetrying(false); }
  };

  // Alert card — entire card opens overlay, no expand
  if (unit.needs_review) {
    if (ap.length === 0) return null;
    return (
      <>
        {confirm && <ConfirmDialog message={`Delete unit "${unit.name}"?`} onConfirm={() => { setConfirm(false); onDelete(); }} onCancel={() => setConfirm(false)} />}
        <div
          onClick={onReview}
          style={{ background: C.bg1, border: `1px solid ${C.warnBorder}`, borderRadius: 6, padding: "13px 15px", marginBottom: 7, cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.warn }}>⚠</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.warn }}>{unit.name}</span>
              <span style={{ fontSize: 10, color: C.warn, fontFamily: mono, opacity: 0.8 }}>— click to assign <span style={{ fontWeight: 700, opacity: 1 }}>[{ap.length} {ap.length === 1 ? "part" : "parts"}]</span> to a unit</span>
            </div>
            <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
              <span style={{ fontSize: 11, color: C.textFaint, fontFamily: mono, marginRight: 8 }}>PARTS: {ap.length}</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {confirm && <ConfirmDialog message={`Delete unit "${unit.name}"?`} onConfirm={() => { setConfirm(false); onDelete(); }} onCancel={() => setConfirm(false)} />}
      <div
        onDoubleClick={!expanded ? (e => { const tag = e.target.tagName; if (tag === "BUTTON" || tag === "INPUT") return; e.preventDefault(); onDuplicate(); }) : undefined}
        onContextMenu={e => { if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT") return; e.preventDefault(); if (rcTimer.current) { clearTimeout(rcTimer.current); rcTimer.current = null; setConfirm(true); } else { rcTimer.current = setTimeout(() => { rcTimer.current = null; }, 200); } }}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Dbl-click: duplicate · Dbl-right-click: delete · Drag to trash"
        style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 7, overflow: "hidden", cursor: "default", userSelect: "none" }}
      >

        {/* Header — click to collapse when expanded */}
        <div
          onClick={expanded ? collapseCard : undefined}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: expanded ? "8px 12px" : "6px 8px 6px 6px", background: expanded ? C.bg3 : C.bg1, borderBottom: expanded ? `1px solid ${C.border}` : "none", cursor: expanded ? "pointer" : "default", userSelect: "none" }}
        >
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
            {expanded && editingName
              ? <input ref={nameRef} value={nameVal} onChange={e => setNameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setNameVal(unit.name); setEditingName(false); } }}
                  onBlur={commitName}
                  style={{ background: "none", border: "none", borderBottom: `1px solid ${C.blue}`, color: C.text, fontFamily: mono, fontSize: 13, fontWeight: 700, outline: "none", padding: "0 2px", width: 160 }} />
              : expanded
                ? <span
                    onClick={e => { e.stopPropagation(); setEditingName(true); }}
                    style={{ fontSize: 13, fontWeight: 700, color: C.text, cursor: "text", flexShrink: 0 }}
                  >{unit.name}</span>
                : <button
                    onClick={e => { e.stopPropagation(); onToggleExpand(); }}
                    onDoubleClick={e => e.stopPropagation()}
                    style={{
                      fontFamily: mono, fontSize: 13, fontWeight: 700, color: C.text,
                      background: C.bg3, border: `1px solid ${C.border2}`,
                      borderRadius: 4, padding: "5px 12px", cursor: "pointer",
                      letterSpacing: "0.04em", flexShrink: 0,
                      transition: "transform 0.07s, background 0.07s, box-shadow 0.07s",
                      boxShadow: `0 2px 0 ${C.border}`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.bg4; e.currentTarget.style.borderColor = C.border2; }}
                    onMouseLeave={e => { e.currentTarget.style.background = C.bg3; e.currentTarget.style.boxShadow = `0 2px 0 ${C.border}`; e.currentTarget.style.transform = "translateY(0)"; }}
                    onMouseDown={e => { e.currentTarget.style.transform = "translateY(2px)"; e.currentTarget.style.boxShadow = "none"; }}
                    onMouseUp={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 2px 0 ${C.border}`; }}
                  >{unit.name}</button>
            }
            {!expanded && unit.note && (
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: mono, flexShrink: 0 }}>{unit.note}</span>
            )}
            {expanded && (
              <span onClick={e => e.stopPropagation()}>
                {editingNote
                  ? <input ref={noteRef} value={noteVal} onChange={e => setNoteVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitNote(); if (e.key === "Escape") { setNoteVal(unit.note || ""); setEditingNote(false); } }}
                      onBlur={commitNote}
                      style={{ background: "none", border: "none", borderBottom: `1px solid ${C.border2}`, color: C.textDim, fontFamily: mono, fontSize: 11, outline: "none", padding: "0 2px", width: 140 }} />
                  : <span
                      onClick={() => setEditingNote(true)}
                      style={{ fontSize: 11, color: C.textFaint, fontFamily: mono, cursor: "text", border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 6px" }}
                    >{unit.note || "add note..."}</span>
                }
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.textFaint, fontFamily: mono }}>
              <span>PARTS: {ap.length}</span>
              <span>RUNNERS: {unit.runners_used?.join(", ")}</span>
            </div>
            <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { if (!expanded) onToggleExpand(); setShowRetry(v => !v); }} style={{ fontSize: 11, padding: "2px 8px", cursor: "pointer", color: showRetry ? C.amber : C.textDim, background: "none", border: `1px solid ${showRetry ? C.amberBorder : C.border}`, borderRadius: 3 }}>↺</button>
            </div>
          </div>        </div>

        {/* Collapsed parts list */}
        {!expanded && (
          <div style={{ padding: "0 15px 12px", fontFamily: mono, fontSize: 12, lineHeight: 1.8, wordBreak: "break-word" }}>
            {ap.map((p, i) => {
              const labels = (unit.runners_used || []).slice().sort((a, b) => b.length - a.length);
              // Match longest label where remainder is non-empty digits, or non-empty lowercase (polycap suffixes)
              // This correctly splits C11 → C1·11 (not C·11) when C1 is in runners_used
              const match = labels.find(l => {
                if (!p.num.startsWith(l)) return false;
                const rest = p.num.slice(l.length);
                return /^\d+$/.test(rest) || /^[a-z]+$/.test(rest);
              });
              const label = match || p.num.match(/^([A-Za-z]+)/)?.[1] || "";
              const rest = p.num.slice(label.length);
              return (
                <span key={i} style={{ fontWeight: 400 }}>
                  {i > 0 && <span style={{ color: "#3a5a70" }}>, </span>}
                  <span style={{ color: "#9ab8cc", fontWeight: 700 }}>{label}</span>
                  {rest && <span style={{ color: "#4a6878", fontSize: 9, letterSpacing: "0.06em", marginLeft: "1.5px" }}>{rest}</span>}
                </span>
              );
            })}
          </div>
        )}

        {/* Expanded edit area */}
        {expanded && (
          <div style={{ padding: "10px 15px 13px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "6px 0" }}>
              {parts.map((p, i) => <UnitChip key={i} part={p} onToggle={() => toggle(i)} onDuplicate={() => dupe(i)} onEdit={num => { const n = [...parts]; n[i] = { ...n[i], num }; onUpdate({ ...unit, parts: n, runners_used: inferRunners(n) }); }} onDelete={() => del(i)} onDragStart={e => { setDragging(true); setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }} />)}
              <AddUnitChip onAdd={add} />
            </div>
            {dragging && (
              <div onDragOver={e => { e.preventDefault(); setDragOverTrash(true); }} onDragLeave={() => setDragOverTrash(false)}
                onDrop={e => { e.preventDefault(); if (dragIdx !== null) del(dragIdx); setDragOverTrash(false); setDragging(false); setDragIdx(null); }}
                onDragEnd={() => { setDragging(false); setDragIdx(null); setDragOverTrash(false); }}
                style={{ padding: "8px", border: `1.5px dashed ${dragOverTrash ? C.red : C.border2}`, borderRadius: 4, textAlign: "center", fontFamily: mono, fontSize: 11, color: dragOverTrash ? C.red : C.textFaint, background: dragOverTrash ? C.redBg : "transparent", transition: "all 0.1s" }}>
                {dragOverTrash ? "release to delete" : "drag here to delete"}
              </div>
            )}
            {showRetry && (
              <div style={{ marginTop: 11, borderTop: `1px solid ${C.amberBorder}`, paddingTop: 11, background: C.amberBg, margin: "11px -15px -13px", padding: "11px 15px 13px", borderRadius: "0 0 6px 6px" }}>
                <input type="text" value={retryName} onChange={e => setRetryName(e.target.value)} placeholder="Unit name" style={{ width: "100%", background: C.bg2, border: `1px solid ${C.amberBorder}`, color: C.textMid, padding: "8px 10px", fontFamily: mono, fontSize: 12, outline: "none", borderRadius: 4, marginBottom: 8 }} />
                <DropZone title="Replacement pages" files={retryFiles} setFiles={setRetryFiles} />
                <button onClick={doRetry} disabled={!retryFiles.length || retrying} style={{ width: "100%", marginTop: 6, padding: "8px", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "none", color: retryFiles.length ? C.amber : C.textFaint, border: `1px solid ${retryFiles.length ? C.amberBorder : C.border}`, borderRadius: 4, fontFamily: mono, letterSpacing: "0.05em" }}>
                  {retrying ? "PROCESSING..." : "REPROCESS UNIT"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Polycap Card ───────────────────────────────────────────────────────────
function PolycapCard({ pc, onUpdate, onDuplicate, onDelete, onDragStart, onDragEnd }) {
  const [editing, setEditing] = useState(false);
  const [labelVal, setLabelVal] = useState(pc.label);
  const [confirm, setConfirm] = useState(false);
  const inputRef = useRef();
  const rcTimer = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commitLabel = () => { setEditing(false); if (labelVal.trim()) onUpdate({ ...pc, label: labelVal.trim() }); else setLabelVal(pc.label); };

  const handleContextMenu = (e) => {
    if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT") return;
    e.preventDefault();
    if (rcTimer.current) {
      clearTimeout(rcTimer.current);
      rcTimer.current = null;
      onDelete();
    } else {
      rcTimer.current = setTimeout(() => { rcTimer.current = null; }, 140);
    }
  };

  return (
    <>
      {confirm && <ConfirmDialog message={`Delete polycap ${pc.label}?`} onConfirm={() => { setConfirm(false); onDelete(); }} onCancel={() => setConfirm(false)} />}
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDoubleClick={e => { const tag = e.target.tagName; if (tag === "BUTTON" || tag === "INPUT") return; e.preventDefault(); onDuplicate(); }}
        onContextMenu={handleContextMenu}
        style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 4, padding: "11px 13px", userSelect: "none", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          {editing
            ? <input ref={inputRef} value={labelVal} onChange={e => setLabelVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitLabel(); if (e.key === "Escape") { setLabelVal(pc.label); setEditing(false); } }}
                onBlur={commitLabel}
                style={{ background: "none", border: "none", borderBottom: `1px solid ${C.blue}`, color: C.text, fontFamily: mono, fontSize: 17, outline: "none", padding: "0 2px", width: 80 }} />
            : <span
                onClick={() => setEditing(true)}
                style={{ fontFamily: mono, fontSize: 17, color: C.text, cursor: "text" }}
              >{pc.label}<span style={{ fontSize: 11, color: C.textDim, marginLeft: 2 }}>x{pc.quantity || 1}</span></span>
          }
          <span style={{ fontSize: 10, padding: "2px 6px", border: `1px solid ${C.border3}`, borderRadius: 3, color: C.textDim }}>POLYCAP</span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={onDuplicate} style={{ fontSize: 10, padding: "2px 7px", cursor: "pointer", color: C.textDim, background: "none", border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: mono }}>+ DUP</button>
          <button onClick={() => setConfirm(true)} style={{ fontSize: 10, padding: "2px 7px", cursor: "pointer", color: C.red, background: "none", border: `1px solid ${C.redBorder}`, borderRadius: 3, fontFamily: mono }}>DELETE</button>
        </div>
      </div>
    </>
  );
}

// ── Drop Zone ──────────────────────────────────────────────────────────────
function DropZone({ title, files, setFiles, note }) {
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();
  const folderRef = useRef();
  const add = (incoming) => {
    const imgs = Array.from(incoming).filter(f => f.type.startsWith("image/"));
    setFiles(prev => { const seen = new Set(prev.map(f => f.name + f.size)); return [...prev, ...imgs.filter(f => !seen.has(f.name + f.size))]; });
  };

  const readEntry = (entry) => new Promise(resolve => {
    if (entry.isFile) {
      entry.file(f => resolve([f]), () => resolve([]));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const allEntries = [];
      const readBatch = () => reader.readEntries(batch => {
        if (!batch.length) {
          Promise.all(allEntries.map(readEntry)).then(results => resolve(results.flat()));
        } else {
          allEntries.push(...batch);
          readBatch();
        }
      }, () => resolve([]));
      readBatch();
    } else {
      resolve([]);
    }
  });

  const onDrop = async (e) => {
    e.preventDefault();
    setDrag(false);
    const items = Array.from(e.dataTransfer.items || []);
    if (items.length && items[0].webkitGetAsEntry) {
      const entries = items.map(i => i.webkitGetAsEntry()).filter(Boolean);
      const results = await Promise.all(entries.map(readEntry));
      add(results.flat());
    } else {
      add(e.dataTransfer.files);
    }
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        style={{ border: `1px dashed ${drag ? C.blue : C.border3}`, background: drag ? "#0f1825" : C.bg1, padding: "12px 14px", borderRadius: 4, display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
        <div style={{ flex: 1 }}>
          {title && <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid, fontFamily: cond }}>{title}</div>}
          {note && <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2, fontFamily: mono }}>{note}</div>}
          {!title && !note && <div style={{ fontSize: 12, color: C.textFaint, fontFamily: mono }}>drop images here</div>}
        </div>
        <button onClick={() => fileRef.current.click()} style={{ fontSize: 10, padding: "4px 8px", cursor: "pointer", color: C.blue, background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 3, fontFamily: mono, flexShrink: 0 }}>FILES</button>
        <button onClick={() => folderRef.current.click()} style={{ fontSize: 10, padding: "4px 8px", cursor: "pointer", color: C.textDim, background: C.bg2, border: `1px solid ${C.border3}`, borderRadius: 3, fontFamily: mono, flexShrink: 0 }}>FOLDER</button>
        <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => add(e.target.files)} />
        <input ref={folderRef} type="file" webkitdirectory="" accept="image/*" style={{ display: "none" }} onChange={e => add(e.target.files)} />
      </div>
      {files && files.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <button onClick={() => setFiles([])} style={{ fontSize: 10, padding: "2px 8px", cursor: "pointer", color: C.textFaint, background: "none", border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: mono }}>clear all</button>
          </div>
          {files.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1a1400", border: "1px solid #3a3000", borderRadius: 4, padding: "4px 6px 4px 10px", fontSize: 11, color: "#ccaa40", fontFamily: mono, marginBottom: 3 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{f.name}</span>
              <button onClick={e => { e.stopPropagation(); setFiles(p => p.filter((_, idx) => idx !== i)); }} style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, cursor: "pointer", color: C.red, fontSize: 11, padding: "1px 6px", borderRadius: 3, marginLeft: 8, flexShrink: 0, fontFamily: mono }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
// ── Runner Range Prompt ────────────────────────────────────────────────────
function RunnerRangePrompt({ onConfirm, onClickOff, onCancel }) {
  const [val, setVal] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef();
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const commit = () => {
    const trimmed = val.trim();
    if (!trimmed) { onConfirm(""); return; }
    const m = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (!m) { setError("Enter a range like 1–33"); return; }
    const lo = parseInt(m[1]), hi = parseInt(m[2]);
    if (hi < 1 || lo < 1) { setError("Min must be at least 1"); return; }
    if (hi < lo) { setError("Max must be greater than or equal to min"); return; }
    onConfirm(trimmed);
  };

  return (
    <div onClick={onClickOff} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: 6, padding: "20px 24px", maxWidth: 300, width: "90%" }}>
        <div style={{ fontSize: 11, fontFamily: mono, color: C.textFaint, letterSpacing: "0.08em", marginBottom: 10 }}>PART RANGE</div>
        <input
          ref={inputRef}
          value={val}
          onChange={e => { setVal(e.target.value); setError(""); }}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel(); }}
          placeholder="1–33"
          style={{ width: "100%", background: C.bg1, border: `1px solid ${error ? C.redBorder : C.border2}`, color: C.text, fontFamily: mono, fontSize: 13, padding: "8px 10px", outline: "none", borderRadius: 4, marginBottom: error ? 6 : 12 }}
        />
        {error && <div style={{ fontSize: 10, color: C.red, fontFamily: mono, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: C.textFaint, fontFamily: mono, flex: 1, lineHeight: 1.4 }}>Click outside to add an empty runner</span>
          <button onClick={onCancel} style={{ padding: "5px 12px", fontSize: 11, cursor: "pointer", color: C.textDim, background: "none", border: `1px solid ${C.border3}`, borderRadius: 3, fontFamily: mono }}>CANCEL</button>
          <button onClick={commit} style={{ padding: "5px 12px", fontSize: 11, cursor: "pointer", color: C.blue, background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 3, fontFamily: mono }}>CREATE</button>
        </div>
      </div>
    </div>
  );
}

export default function GundamNucleus() {
  const [view, setView] = useState("extract");
  const [kit, setKit] = useState({ name: "", brand: "", grade: "", scale: "", mfgDate: "" });
  const [runnerFiles, setRunnerFiles] = useState([]);
  const [indexFiles, setIndexFiles] = useState([]);
  const [asmFiles, setAsmFiles] = useState([]);
  const [uploadUndoStack, setUploadUndoStack] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState([]);
  const [undoStack, setUndoStack] = useState({ runners: [], polycaps: [], units: [] });
  const [showRunnerRetry, setShowRunnerRetry] = useState(false);
  const [showIndexRetry, setShowIndexRetry] = useState(false);
  const [retryRunnerFiles, setRetryRunnerFiles] = useState([]);
  const [retryIndexFiles, setRetryIndexFiles] = useState([]);

  const uploadFilesRef = useRef({ runnerFiles: [], indexFiles: [], asmFiles: [] });
  useEffect(() => { uploadFilesRef.current = { runnerFiles, indexFiles, asmFiles }; }, [runnerFiles, indexFiles, asmFiles]);

  const pushUploadUndo = useCallback(() => {
    setUploadUndoStack(s => [...s.slice(-9), { ...uploadFilesRef.current }]);
  }, []);

  const undoUpload = useCallback(() => {
    setUploadUndoStack(s => {
      if (!s.length) return s;
      const prev = s[s.length - 1];
      setRunnerFiles(prev.runnerFiles);
      setIndexFiles(prev.indexFiles);
      setAsmFiles(prev.asmFiles);
      return s.slice(0, -1);
    });
  }, []);

  const makeUploadSetter = useCallback((setter) => (val) => {
    pushUploadUndo();
    setter(val);
  }, [pushUploadUndo]);

  const pushUndo = useCallback((section, prev) => {
    setUndoStack(s => ({ ...s, [section]: [...s[section].slice(-9), prev] }));
  }, []);

  const undo = useCallback((section) => {
    setUndoStack(s => {
      const stack = s[section];
      if (!stack.length) return s;
      const prev = stack[stack.length - 1];
      setResult(r => ({ ...r, [section]: prev }));
      return { ...s, [section]: stack.slice(0, -1) };
    });
  }, []);

  // Global ctrl+z
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (!result && uploadUndoStack.length) { undoUpload(); return; }
        const sections = ["units", "runners", "polycaps"];
        for (const s of sections) {
          if (undoStack[s]?.length) { undo(s); break; }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, undoStack, undoUpload, uploadUndoStack, result]);

  const loadMockData = () => {
    setKit({ name: "ORB-01 Akatsuki Gundam", brand: "Bandai", grade: "NG", scale: "1/100", mfgDate: "08/2004" });
    const ts = Date.now();
    setResult({
      runners: [
        { _id: `r-A-${ts}`, label: "A", quantity: 1, material: "PS", runners: [{ parts: [{ num: "1", active: true }, { num: "2", active: true }, { num: "3", active: true }, { num: "4", active: true }, { num: "5", active: false }, { num: "6", active: true }, { num: "7", active: true }, { num: "8", active: true }, { num: "9", active: true }, { num: "10", active: true }, { num: "11", active: true }, { num: "12", active: true }, { num: "13", active: true }, { num: "14", active: true }, { num: "15", active: true }, { num: "16", active: true }, { num: "17", active: true }, { num: "18", active: true }, { num: "19", active: true }, { num: "20", active: true }, { num: "21", active: true }, { num: "22", active: true }, { num: "23", active: true }, { num: "24", active: true }, { num: "25", active: true }, { num: "26", active: true }, { num: "27", active: true }, { num: "28", active: true }, { num: "29", active: true }, { num: "30", active: true }, { num: "31", active: true }, { num: "32", active: true }, { num: "33", active: true }] }] },
        { _id: `r-B-${ts}`, label: "B", quantity: 1, material: "PS", runners: [{ parts: [{ num: "1", active: true }, { num: "2", active: true }, { num: "3", active: true }, { num: "4", active: true }, { num: "5", active: true }, { num: "6", active: true }, { num: "7", active: true }, { num: "8", active: true }, { num: "9", active: true }, { num: "10", active: true }, { num: "11", active: true }, { num: "12", active: true }, { num: "13", active: true }, { num: "14", active: true }, { num: "15", active: true }, { num: "16", active: true }, { num: "17", active: true }, { num: "18", active: true }, { num: "19", active: true }, { num: "20", active: true }] }] },
        { _id: `r-C1-${ts}`, label: "C1", quantity: 1, material: "PS", runners: [{ parts: [{ num: "1", active: true }, { num: "2", active: true }, { num: "3", active: true }, { num: "4", active: true }, { num: "5", active: true }, { num: "6", active: true }, { num: "7", active: true }, { num: "8", active: true }, { num: "9", active: true }, { num: "10", active: true }, { num: "11", active: true }] }] },
        { _id: `r-C2-${ts}`, label: "C2", quantity: 1, material: "PS", runners: [{ parts: [{ num: "1", active: true }, { num: "2", active: true }, { num: "3", active: true }, { num: "4", active: true }, { num: "5", active: true }] }] },
        { _id: `r-D-${ts}`, label: "D", quantity: 1, material: "PS", runners: [{ parts: [{ num: "1", active: true }, { num: "2", active: true }, { num: "3", active: true }, { num: "4", active: true }, { num: "5", active: true }, { num: "6", active: true }, { num: "7", active: true }, { num: "8", active: true }, { num: "9", active: true }, { num: "10", active: true }, { num: "11", active: true }, { num: "12", active: true }, { num: "13", active: true }, { num: "14", active: true }] }, { parts: [{ num: "1", active: true }, { num: "2", active: true }, { num: "3", active: true }, { num: "4", active: true }, { num: "5", active: true }, { num: "6", active: true }, { num: "7", active: true }, { num: "8", active: true }, { num: "9", active: true }, { num: "10", active: true }, { num: "11", active: true }, { num: "12", active: true }, { num: "13", active: true }, { num: "14", active: false }] }] },
        { _id: `r-H-${ts}`, label: "H", quantity: 1, material: "ABS", runners: [{ parts: [{ num: "1", active: true }, { num: "2", active: true }, { num: "3", active: true }, { num: "4", active: true }, { num: "5", active: true }, { num: "6", active: true }, { num: "7", active: true }] }] },
      ],
      polycaps: [
        { label: "PC", quantity: 1 },
      ],
      units: [
        { name: "BODY", unit_number: "1", note: null, needs_review: false, runners_used: ["A", "B", "H"], parts: [{ num: "B7", active: true }, { num: "B20", active: true }, { num: "B4", active: true }, { num: "H1", active: true }, { num: "H2", active: true }, { num: "PCc", active: true }, { num: "B9", active: true }, { num: "B11", active: true }, { num: "A2", active: true }, { num: "C14", active: true }] },
        { name: "HEAD", unit_number: "2", note: null, needs_review: false, runners_used: ["A", "C1", "H"], parts: [{ num: "A3", active: true }, { num: "A9", active: true }, { num: "H7", active: true }, { num: "H6", active: true }, { num: "H8", active: true }, { num: "C11", active: true }, { num: "C10", active: true }, { num: "H10", active: true }, { num: "H11", active: true }, { num: "A1", active: true }, { num: "H5", active: true }] },
        { name: "RIGHT ARM", unit_number: "3", note: "L/R identical", needs_review: false, runners_used: ["A", "B", "C", "H"], parts: [{ num: "A24", active: true }, { num: "C8", active: true }, { num: "D2", active: true }, { num: "C9", active: true }, { num: "J4", active: true }] },
        { name: "WAIST", unit_number: "6", note: null, needs_review: false, runners_used: ["B", "H"], parts: [{ num: "B1", active: true }, { num: "B6", active: true }, { num: "B2", active: true }, { num: "B3", active: true }, { num: "B8", active: true }, { num: "H6", active: true }] },
        { name: "RIGHT LEG", unit_number: "7", note: null, needs_review: false, runners_used: ["C", "D", "I", "J", "PC"], parts: [{ num: "C7", active: true }, { num: "J1", active: true }, { num: "J2", active: true }, { num: "PCa", active: true }, { num: "I10", active: true }, { num: "I11", active: true }, { num: "I12", active: true }, { num: "I13", active: true }, { num: "D1", active: true }, { num: "D5", active: true }, { num: "D6", active: true }, { num: "D8", active: true }, { num: "D12", active: true }, { num: "D13", active: true }, { num: "PCb", active: true }] },
        { name: "STEP 10", unit_number: "10", note: null, needs_review: true, runners_used: ["B"], parts: [{ num: "B1", active: true }, { num: "B6", active: true }] },
      ]
    });
  };

  const totalRunners = result
    ? (result.runners?.reduce((s, r) => s + (r.quantity || 1), 0) || 0) + (result.polycaps?.reduce((s, p) => s + (p.quantity || 1), 0) || 0)
    : 0;

  const extract = async () => {
    const allRaw = [...runnerFiles, ...indexFiles, ...asmFiles];
    if (!allRaw.length) { setError("Upload at least one image."); return; }
    const all = sortFilesByName(allRaw);
    setLoading(true); setError(null); setResult(null);
    try {
      setLoadMsg("Sending to vision model...");
      const lbl = [kit.name, kit.grade, kit.scale].filter(Boolean).join(", ") || "this kit";
      const data = await callClaude(all, `Extract all Gunpla kit data from these manual pages. Kit: ${lbl}. Images may be out of order — use internal page/step/unit numbers. Return raw JSON only.`, false);
      if (data.runners) data.runners = data.runners.map((r, i) => ({ ...r, _id: `runner-${i}-${Date.now()}-${Math.random().toString(36).slice(2)}`, runners: r.runners?.length ? r.runners : [{ parts: r.parts || [] }], parts: undefined }));
      if (!data.polycaps) data.polycaps = [];
      if (!data.units) data.units = [];
      setExpandedRunnerIds([]);
      setResult(data);
    } catch (e) { setError("Extraction failed — " + e.message); }
    finally { setLoading(false); setLoadMsg(""); }
  };

  const [runnerRangePrompt, setRunnerRangePrompt] = useState(false);

  const addBlankRunner = () => setRunnerRangePrompt(true);

  const commitNewRunner = (rangeStr) => {
    setRunnerRangePrompt(false);
    pushUndo("runners", result.runners);
    let parts = [];
    if (rangeStr && rangeStr.trim()) {
      const m = rangeStr.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (m) {
        const lo = parseInt(m[1]), hi = parseInt(m[2]);
        if (!isNaN(lo) && !isNaN(hi) && hi >= lo) {
          parts = Array.from({ length: hi - lo + 1 }, (_, k) => ({ num: String(lo + k), active: true }));
        }
      }
    }
    setResult(p => ({ ...p, runners: [...(p.runners || []), { _id: `runner-${Date.now()}`, label: "?", quantity: 1, material: null, runners: [{ parts }] }] }));
  };

  const [expandedRunnerIds, setExpandedRunnerIds] = useState([]); // ordered array for stacking
  const [expandedUnitIds, setExpandedUnitIds] = useState(new Set());
  const [reviewUnit, setReviewUnit] = useState(null);
  const [saveWarning, setSaveWarning] = useState(false);
  const [draggingPcIdx, setDraggingPcIdx] = useState(null);
  const [pcDragOverTrash, setPcDragOverTrash] = useState(false);
  const [draggingRunnerId, setDraggingRunnerId] = useState(null);
  const [runnerDragOverTrash, setRunnerDragOverTrash] = useState(false);
  const [draggingUnitKey, setDraggingUnitKey] = useState(null);
  const [unitDragOverTrash, setUnitDragOverTrash] = useState(false);
  const runnersGridRef = useRef();
  const polycapsRef = useRef();
  const unitsListRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      const inRunners = runnersGridRef.current?.contains(e.target);
      const inPolycaps = polycapsRef.current?.contains(e.target);
      const inUnits = unitsListRef.current?.contains(e.target);
      if (!inRunners && !inPolycaps && !inUnits) {
        setExpandedRunnerIds([]);
        setExpandedUnitIds(new Set());
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unresolvedReviews = result?.units?.filter(u => u.needs_review) || [];

  const assignUnit = (flaggedUnit, targetUnit) => {
    pushUndo("units", result.units);
    setResult(p => {
      const units = p.units.map(u => {
        if (u === targetUnit) {
          const merged = [...(u.parts || []), ...(flaggedUnit.parts || [])];
          const inferRunners = (pts) => { const s = new Set(pts.filter(x => x.active).map(x => x.num.match(/^([A-Z]+\d*)/)?.[1]).filter(Boolean)); return [...s].sort(); };
          return { ...u, parts: merged, runners_used: inferRunners(merged) };
        }
        return u;
      }).filter(u => u !== flaggedUnit);
      return { ...p, units };
    });
    setReviewUnit(null);
  };

  const assignPart = (flaggedUnit, part, targetUnit) => {
    pushUndo("units", result.units);
    setResult(p => {
      const inferRunners = (pts) => { const s = new Set(pts.filter(x => x.active).map(x => x.num.match(/^([A-Z]+\d*)/)?.[1]).filter(Boolean)); return [...s].sort(); };
      const remaining = (flaggedUnit.parts || []).filter(x => x !== part);
      const units = p.units.map(u => {
        if (u === targetUnit) {
          const merged = [...(u.parts || []), part];
          return { ...u, parts: merged, runners_used: inferRunners(merged) };
        }
        if (u === flaggedUnit) {
          return { ...u, parts: remaining, runners_used: inferRunners(remaining) };
        }
        return u;
      });
      // Remove flagged unit if no active parts remain
      const updated = activeParts(remaining).length === 0 ? units.filter(u => u !== flaggedUnit) : units;
      // Close overlay if flagged unit is gone
      if (activeParts(remaining).length === 0) setReviewUnit(null);
      return { ...p, units: updated };
    });
  };

  const dismissReview = (unit) => {
    pushUndo("units", result.units);
    setResult(p => {
      const rest = p.units.filter(u => u !== unit);
      return { ...p, units: [...rest, { ...unit, _dismissed: true }] };
    });
    setReviewUnit(null);
  };

  const saveKit = () => {
    if (unresolvedReviews.length > 0) { setSaveWarning(true); return; }
    doSave();
  };
  const doSave = () => { setSaved(p => [{ id: Date.now(), savedAt: Date.now(), ...kit, runners: result.runners, polycaps: result.polycaps, units: result.units }, ...p]); setSaveWarning(false); };
  const exportTxt = () => {
    const b = new Blob([buildText({ ...kit, runners: result.runners, polycaps: result.polycaps, units: result.units })], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${(kit.name || "kit").replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(a.href), 100);
  };
  const exportJson = () => {
    const b = new Blob([JSON.stringify({ ...kit, runners: result.runners, polycaps: result.polycaps, units: result.units }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${(kit.name || "kit").replace(/\s+/g, "_")}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(a.href), 100);
  };
  const resetResult = () => { setResult(null); setRunnerFiles([]); setIndexFiles([]); setAsmFiles([]); setError(null); setUndoStack({ runners: [], polycaps: [], units: [] }); setUploadUndoStack([]); };
  const clearAll = () => { resetResult(); setKit({ name: "", brand: "", grade: "", scale: "", mfgDate: "" }); };

  const inputStyle = { background: C.bg2, border: `1px solid ${C.border3}`, color: C.textMid, padding: "9px 11px", fontFamily: mono, fontSize: 12, outline: "none", width: "100%", borderRadius: 4 };
  const tabStyle = (active) => ({ padding: "5px 12px", fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400, background: active ? C.bg3 : "none", color: active ? C.text : C.textFaint, border: `1px solid ${active ? C.border2 : C.border}`, borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: mono });

  const SectionHeader = ({ text, section, onAdd }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontFamily: mono, letterSpacing: "0.1em", color: C.textFaint, textTransform: "uppercase" }}>{text}</div>
      <div style={{ display: "flex", gap: 5 }}>
        {section && undoStack[section]?.length > 0 && <button onClick={() => undo(section)} style={{ fontSize: 10, padding: "2px 8px", cursor: "pointer", color: C.amber, background: "none", border: `1px solid ${C.amberBorder}`, borderRadius: 3, fontFamily: mono }}>↩ UNDO</button>}
        <button onClick={() => { pushUndo(section, result[section]); setResult(p => ({ ...p, [section]: [] })); }} style={{ fontSize: 10, padding: "2px 8px", cursor: "pointer", color: C.textFaint, background: "none", border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: mono }}>clear</button>
        {onAdd && <button onClick={onAdd} style={{ fontSize: 10, padding: "2px 8px", cursor: "pointer", color: C.blue, background: "none", border: `1px solid ${C.blueBorder}`, borderRadius: 3, fontFamily: mono }}>+ ADD</button>}
      </div>
    </div>
  );

  return (
    <>
      <style>{`${FONTS} *{box-sizing:border-box;margin:0;padding:0;} body{background:${C.bg};}`}</style>
      {reviewUnit && (() => {
        const liveUnit = result?.units?.find(u => (u.unit_number || u.name) === reviewUnit) || null;
        if (!liveUnit) return null;
        return (
          <ReviewOverlay
            unit={liveUnit}
            units={result?.units || []}
            onAssign={(target) => assignUnit(liveUnit, target)}
            onAssignPart={(part, target) => assignPart(liveUnit, part, target)}
            onDismiss={() => dismissReview(liveUnit)}
            onUndismiss={() => { pushUndo("units", result.units); setResult(p => ({ ...p, units: p.units.map(x => (x.unit_number || x.name) === reviewUnit ? { ...x, _dismissed: false } : x) })); setReviewUnit(null); }}
            onClose={() => setReviewUnit(null)}
          />
        );
      })()}
      {runnerRangePrompt && <RunnerRangePrompt onConfirm={commitNewRunner} onClickOff={() => commitNewRunner("")} onCancel={() => setRunnerRangePrompt(false)} />}
      {saveWarning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.bg2, border: `1px solid ${C.warnBorder}`, borderRadius: 8, padding: "22px 24px", maxWidth: 380, width: "100%" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.warn, fontFamily: mono, marginBottom: 8 }}>⚠ UNRESOLVED REVIEWS</div>
            <div style={{ fontSize: 12, color: C.textMid, fontFamily: mono, marginBottom: 18, lineHeight: 1.6 }}>
              {unresolvedReviews.length} unit{unresolvedReviews.length > 1 ? "s" : ""} still need review: {unresolvedReviews.map(u => u.name).join(", ")}. Save anyway?
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setSaveWarning(false)} style={{ padding: "6px 14px", fontSize: 11, cursor: "pointer", color: C.textDim, background: "none", border: `1px solid ${C.border3}`, borderRadius: 3, fontFamily: mono }}>GO BACK</button>
              <button onClick={doSave} style={{ padding: "6px 14px", fontSize: 11, cursor: "pointer", color: C.warn, background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 3, fontFamily: mono }}>SAVE ANYWAY</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "26px 16px 80px", fontFamily: cond, background: C.bg, minHeight: "100vh", color: C.textMid }}>

        <div style={{ marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.1em", color: C.text, fontFamily: mono }}>
                <span style={{ color: C.blue }}>G</span>UNDAM <span style={{ color: C.blue }}>N</span>UCLEUS
              </div>
              <div style={{ fontSize: 10, color: C.textFaint, fontFamily: mono, letterSpacing: "0.08em", marginTop: 3 }}>MANUAL EXTRACTION SYSTEM // VEDA CONTRIBUTION TOOL</div>
            </div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <button onClick={loadMockData} style={{ fontSize: 9, padding: "3px 7px", cursor: "pointer", color: C.textFaint, background: "none", border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: mono, letterSpacing: "0.05em", opacity: 0.5 }}>DEV</button>
              {[["extract", "EXTRACT"], ["saved", `SAVED (${saved.length})`]].map(([v, l]) => (
                <button key={v} onClick={() => setView(v)} style={tabStyle(view === v)}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {view === "saved" && (
          saved.length === 0
            ? <div style={{ textAlign: "center", padding: "40px 0", color: C.textFaint, fontSize: 13, fontFamily: mono }}>No saved kits yet.</div>
            : saved.map(k => (
              <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 13px", background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 4, gap: 10, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name || "Unnamed Kit"}</div>
                  <div style={{ fontSize: 11, color: C.textFaint, fontFamily: mono, marginTop: 1 }}>{[k.brand, k.grade, k.scale].filter(Boolean).join(" · ")}{k.savedAt && <span style={{ marginLeft: 8 }}>{new Date(k.savedAt).toLocaleDateString()}</span>}</div>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button onClick={() => { setKit({ name: k.name || "", brand: k.brand || "", grade: k.grade || "", scale: k.scale || "", mfgDate: k.mfgDate || "" }); setResult({ runners: (k.runners || []).map((r, i) => r._id ? r : { ...r, _id: `runner-${i}-${Date.now()}-${Math.random().toString(36).slice(2)}` }), polycaps: k.polycaps, units: k.units }); setView("extract"); }} style={{ fontSize: 11, padding: "3px 9px", cursor: "pointer", color: C.textDim, background: "none", border: `1px solid ${C.border3}`, borderRadius: 3 }}>load</button>
                  <button onClick={() => setSaved(p => p.filter(x => x.id !== k.id))} style={{ fontSize: 11, padding: "3px 9px", cursor: "pointer", color: C.red, background: "none", border: `1px solid ${C.redBorder}`, borderRadius: 3 }}>✕</button>
                </div>
              </div>
            ))
        )}

        {view === "extract" && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontFamily: mono, letterSpacing: "0.1em", color: C.textFaint, marginBottom: 8, textTransform: "uppercase" }}>Kit reference — all fields optional</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 7, marginBottom: 7 }}>
                {[["name", "Mobile suit / kit name"], ["brand", "Brand"], ["grade", "MG / HG / NG / PG"]].map(([k, ph]) => (
                  <input key={k} type="text" placeholder={ph} value={kit[k]} onChange={e => setKit(p => ({ ...p, [k]: e.target.value }))} style={inputStyle} />
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {[["scale", "Scale (1/100)"], ["mfgDate", "Mfg date (MM/YYYY)"]].map(([k, ph]) => (
                  <input key={k} type="text" placeholder={ph} value={kit[k]} onChange={e => setKit(p => ({ ...p, [k]: e.target.value }))} style={inputStyle} />
                ))}
              </div>
            </div>

            {!result && (
              <>
                <div style={{ fontSize: 10, fontFamily: mono, letterSpacing: "0.1em", color: C.textFaint, marginBottom: 8, textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Upload sequence</span>
                  {uploadUndoStack.length > 0 && <button onClick={undoUpload} style={{ fontSize: 10, padding: "2px 8px", cursor: "pointer", color: C.amber, background: "none", border: `1px solid ${C.amberBorder}`, borderRadius: 3, fontFamily: mono }}>↩ UNDO</button>}
                </div>
                <DropZone title="1 · Runner inventory pages" files={runnerFiles} setFiles={makeUploadSetter(setRunnerFiles)} note="Pages showing runner layouts and part numbers" />
                <DropZone title="2 · Index / overview page" files={indexFiles} setFiles={makeUploadSetter(setIndexFiles)} note="Optional — full kit diagram with numbered unit labels" />
                <DropZone title="3 · Assembly instruction pages" files={asmFiles} setFiles={makeUploadSetter(setAsmFiles)} note="Upload in page order or by folder — auto-sorted by filename" />
                {error && <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 4, color: C.red, padding: "9px 13px", fontSize: 11, fontFamily: mono, marginBottom: 10 }}>⚠ {error}</div>}
                <button onClick={extract} disabled={loading} style={{ width: "100%", padding: "12px", cursor: loading ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", background: loading ? C.bg1 : C.bg3, color: loading ? C.textFaint : C.text, border: `1px solid ${loading ? C.border : C.border2}`, borderRadius: 4, fontFamily: mono, opacity: loading ? 0.6 : 1 }}>
                  {loading ? (loadMsg || "PROCESSING...") : "EXTRACT KIT DATA"}
                </button>
              </>
            )}

            {result && (
              <>
                <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{kit.name || "Kit"}</div>
                      <div style={{ fontSize: 11, color: C.textFaint, fontFamily: mono, marginTop: 2 }}>{[kit.brand, kit.grade, kit.scale, kit.mfgDate].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => { setShowRunnerRetry(v => !v); setShowIndexRetry(false); }} style={{ fontSize: 10, padding: "2px 8px", cursor: "pointer", color: showRunnerRetry ? C.blue : C.textFaint, background: "none", border: `1px solid ${showRunnerRetry ? C.blueBorder : C.border}`, borderRadius: 3, fontFamily: mono, letterSpacing: "0.05em" }}>↺ RUNNERS</button>
                      <button onClick={() => { setShowIndexRetry(v => !v); setShowRunnerRetry(false); }} style={{ fontSize: 10, padding: "2px 8px", cursor: "pointer", color: showIndexRetry ? C.blue : C.textFaint, background: "none", border: `1px solid ${showIndexRetry ? C.blueBorder : C.border}`, borderRadius: 3, fontFamily: mono, letterSpacing: "0.05em" }}>↺ INDEX</button>
                      <div style={{ fontFamily: mono, fontSize: 11, color: C.textDim, marginLeft: 8 }}>{totalRunners} RUNNERS</div>
                    </div>
                  </div>
                  {(showRunnerRetry || showIndexRetry) && (
                    <div style={{ marginTop: 12, padding: "12px 14px", background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: 6 }}>
                      {showRunnerRetry && (
                        <>
                          <DropZone title="Replacement runner pages" files={retryRunnerFiles} setFiles={setRetryRunnerFiles} note="Re-upload runner inventory pages to re-extract" />
                          <button
                            disabled={!retryRunnerFiles.length || loading}
                            onClick={async () => {
                              setLoading(true); setError(null);
                              try {
                                const lbl = [kit.name, kit.grade, kit.scale].filter(Boolean).join(", ") || "this kit";
                                const data = await callClaude(sortFilesByName(retryRunnerFiles), `Extract runner inventory data from these manual pages. Kit: ${lbl}. Return raw JSON only.`, false);
                                if (data.runners) {
                                  const mapped = data.runners.map((r, i) => ({ ...r, _id: `runner-${i}-${Date.now()}-${Math.random().toString(36).slice(2)}`, runners: r.runners?.length ? r.runners : [{ parts: r.parts || [] }], parts: undefined }));
                                  pushUndo("runners", result.runners);
                                  setResult(p => ({ ...p, runners: mapped, polycaps: data.polycaps?.length ? data.polycaps : p.polycaps }));
                                }
                                setRetryRunnerFiles([]); setShowRunnerRetry(false);
                              } catch(e) { setError("Re-extraction failed — " + e.message); }
                              finally { setLoading(false); }
                            }}
                            style={{ width: "100%", marginTop: 4, padding: "7px", cursor: "pointer", fontSize: 11, fontWeight: 700, background: "none", color: retryRunnerFiles.length ? C.blue : C.textFaint, border: `1px solid ${retryRunnerFiles.length ? C.blueBorder : C.border}`, borderRadius: 4, fontFamily: mono, letterSpacing: "0.05em" }}>
                            {loading ? "PROCESSING..." : "REPROCESS RUNNERS"}
                          </button>
                        </>
                      )}
                      {showIndexRetry && (
                        <>
                          <DropZone title="Replacement index page" files={retryIndexFiles} setFiles={setRetryIndexFiles} note="Re-upload the kit overview / unit index page" />
                          <button
                            disabled={!retryIndexFiles.length || loading}
                            onClick={async () => {
                              setLoading(true); setError(null);
                              try {
                                const lbl = [kit.name, kit.grade, kit.scale].filter(Boolean).join(", ") || "this kit";
                                const data = await callClaude(retryIndexFiles, `Extract the unit index from this kit overview page. Kit: ${lbl}. Return raw JSON only.`, false);
                                if (data.unit_index) setResult(p => ({ ...p, unit_index: data.unit_index }));
                                setRetryIndexFiles([]); setShowIndexRetry(false);
                              } catch(e) { setError("Re-extraction failed — " + e.message); }
                              finally { setLoading(false); }
                            }}
                            style={{ width: "100%", marginTop: 4, padding: "7px", cursor: "pointer", fontSize: 11, fontWeight: 700, background: "none", color: retryIndexFiles.length ? C.blue : C.textFaint, border: `1px solid ${retryIndexFiles.length ? C.blueBorder : C.border}`, borderRadius: 4, fontFamily: mono, letterSpacing: "0.05em" }}>
                            {loading ? "PROCESSING..." : "REPROCESS INDEX"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {(result.runners?.length > 0 || true) && (
                  <div style={{ marginBottom: 18 }} ref={runnersGridRef}>
                    <SectionHeader text="Runners" section="runners" onAdd={addBlankRunner} />
                    <div>
                      {/* Expanded runners — stacked in open order */}
                      {expandedRunnerIds
                        .map(id => result.runners?.find(r => r._id === id))
                        .filter(Boolean)
                        .map(r => {
                          const i = result.runners.indexOf(r);
                          return (
                            <div key={r._id} style={{ marginBottom: 8 }}>
                              <RunnerCard runner={r}
                                isExpanded={true}
                                onToggleExpand={(id) => { setExpandedRunnerIds(prev => prev.filter(x => x !== id)); }}
                                onUpdate={upd => { pushUndo("runners", result.runners); setResult(p => { const rs = [...p.runners]; rs[i] = { ...upd, _id: r._id }; return { ...p, runners: rs }; }); }}
                                onDuplicate={() => { pushUndo("runners", result.runners); setResult(p => { const rs = [...p.runners]; const copy = { ...r, _id: `runner-${Date.now()}` }; rs.splice(i + 1, 0, copy); return { ...p, runners: rs }; }); }}
                                onDelete={() => { pushUndo("runners", result.runners); setExpandedRunnerIds(prev => prev.filter(x => x !== r._id)); setResult(p => ({ ...p, runners: p.runners.filter((_, idx) => idx !== i) })); }}
                              />
                            </div>
                          );
                        })
                      }
                      {/* Collapsed runners — in a grid */}
                      {(result.runners || []).some(r => !expandedRunnerIds.includes(r._id)) && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7, alignItems: "start", marginTop: expandedRunnerIds.length > 0 ? 8 : 0 }}>
                          {(result.runners || []).filter(r => !expandedRunnerIds.includes(r._id)).map(r => {
                            const i = result.runners.indexOf(r);
                            return (
                              <RunnerCard key={r._id || i} runner={r}
                                isExpanded={false}
                                onToggleExpand={(id) => {
                                  if (!id) return;
                                 
                                  setExpandedRunnerIds(prev => {
                                    const runners = result.runners || [];
                                    const newIdx = runners.findIndex(r => r._id === id);
                                    let insertAt = 0;
                                    for (let j = 0; j < prev.length; j++) {
                                      const srcIdx = runners.findIndex(r => r._id === prev[j]);
                                      if (srcIdx < newIdx) insertAt = j + 1;
                                    }
                                    const next = [...prev];
                                    next.splice(insertAt, 0, id);
                                    return next;
                                  });
                                }}
                                onUpdate={upd => { pushUndo("runners", result.runners); setResult(p => { const rs = [...p.runners]; rs[i] = { ...upd, _id: r._id }; return { ...p, runners: rs }; }); }}
                                onDuplicate={() => { pushUndo("runners", result.runners); setResult(p => { const rs = [...p.runners]; const copy = { ...r, _id: `runner-${Date.now()}` }; rs.splice(i + 1, 0, copy); return { ...p, runners: rs }; }); }}
                                onDelete={() => { pushUndo("runners", result.runners); setResult(p => ({ ...p, runners: p.runners.filter((_, idx) => idx !== i) })); }}
                                onDragStart={e => { setDraggingRunnerId(r._id); e.dataTransfer.effectAllowed = "move"; }}
                                onDragEnd={() => { setDraggingRunnerId(null); setRunnerDragOverTrash(false); }}
                              />
                            );
                          })}
                        </div>
                      )}
                      {draggingRunnerId !== null && (
                        <div
                          onDragOver={e => { e.preventDefault(); setRunnerDragOverTrash(true); }}
                          onDragLeave={() => setRunnerDragOverTrash(false)}
                          onDrop={e => { e.preventDefault(); const r = result.runners.find(x => x._id === draggingRunnerId); if (r) { pushUndo("runners", result.runners); setResult(p => ({ ...p, runners: p.runners.filter(x => x._id !== draggingRunnerId) })); } setDraggingRunnerId(null); setRunnerDragOverTrash(false); }}
                          style={{ marginTop: 7, padding: "8px", border: `1.5px dashed ${runnerDragOverTrash ? C.red : C.border2}`, borderRadius: 4, textAlign: "center", fontFamily: mono, fontSize: 11, color: runnerDragOverTrash ? C.red : C.textFaint, background: runnerDragOverTrash ? C.redBg : "transparent", transition: "all 0.1s" }}>
                          {runnerDragOverTrash ? "release to delete" : "drag here to delete"}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(result.polycaps?.length > 0 || true) && (
                  <div ref={polycapsRef} style={{ marginBottom: 18 }}>
                    <SectionHeader text="Polycaps" section="polycaps"
                      onAdd={() => { pushUndo("polycaps", result.polycaps); setResult(p => ({ ...p, polycaps: [...(p.polycaps || []), { label: "PC", quantity: 1 }] })); }}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 7 }}>
                      {(result.polycaps || []).map((pc, i) => (
                        <PolycapCard key={i} pc={pc}
                          onUpdate={upd => { pushUndo("polycaps", result.polycaps); setResult(p => { const pcs = [...p.polycaps]; pcs[i] = upd; return { ...p, polycaps: pcs }; }); }}
                          onDuplicate={() => { pushUndo("polycaps", result.polycaps); setResult(p => { const pcs = [...p.polycaps]; pcs.splice(i + 1, 0, { ...pc, label: pc.label }); return { ...p, polycaps: pcs }; }); }}
                          onDelete={() => { pushUndo("polycaps", result.polycaps); setResult(p => ({ ...p, polycaps: p.polycaps.filter((_, idx) => idx !== i) })); }}
                          onDragStart={e => { setDraggingPcIdx(i); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { setDraggingPcIdx(null); setPcDragOverTrash(false); }}
                        />
                      ))}
                    </div>
                    {draggingPcIdx !== null && (
                      <div
                        onDragOver={e => { e.preventDefault(); setPcDragOverTrash(true); }}
                        onDragLeave={() => setPcDragOverTrash(false)}
                        onDrop={e => { e.preventDefault(); pushUndo("polycaps", result.polycaps); setResult(p => ({ ...p, polycaps: p.polycaps.filter((_, idx) => idx !== draggingPcIdx) })); setDraggingPcIdx(null); setPcDragOverTrash(false); }}
                        style={{ marginTop: 7, padding: "8px", border: `1.5px dashed ${pcDragOverTrash ? C.red : C.border2}`, borderRadius: 4, textAlign: "center", fontFamily: mono, fontSize: 11, color: pcDragOverTrash ? C.red : C.textFaint, background: pcDragOverTrash ? C.redBg : "transparent", transition: "all 0.1s" }}>
                        {pcDragOverTrash ? "release to delete" : "drag here to delete"}
                      </div>
                    )}
                  </div>
                )}

                {(result.units?.length > 0 || true) && (
                  <div ref={unitsListRef} style={{ marginBottom: 18 }}>
                    <SectionHeader text="Assembly units" section="units"
                      onAdd={() => {
                        pushUndo("units", result.units);
                        const newUnit = {
                          name: "NEW UNIT",
                          unit_number: String((result.units?.length || 0) + 1),
                          note: null,
                          needs_review: false,
                          runners_used: [],
                          parts: [],
                        };
                        setResult(p => ({ ...p, units: [...(p.units || []), newUnit] }));
                        // Auto-expand the new unit
                        const uid = newUnit.unit_number || newUnit.name;
                        setExpandedUnitIds(prev => { const next = new Set(prev); next.add(uid); return next; });
                       
                      }}
                    />
                    {[...result.units].sort((a, b) => (b.needs_review && !b._dismissed ? 1 : 0) - (a.needs_review && !a._dismissed ? 1 : 0)).map((u) => {
                      const uid = u.unit_number || u.name;
                      return (
                        <UnitCard key={uid} unit={u}
                          isExpanded={expandedUnitIds.has(uid)}
                          onToggleExpand={() => { setExpandedUnitIds(prev => { const next = new Set(prev); next.has(uid) ? next.delete(uid) : next.add(uid); return next; }); }}
                          onUpdate={upd => { pushUndo("units", result.units); setResult(p => ({ ...p, units: p.units.map(x => x === u ? upd : x) })); }}
                          onDelete={() => { pushUndo("units", result.units); setResult(p => ({ ...p, units: p.units.filter(x => x !== u) })); }}
                          onDuplicate={() => { pushUndo("units", result.units); setResult(p => { const idx = p.units.indexOf(u); const copy = { ...u, unit_number: `${u.unit_number}-copy`, name: `${u.name} COPY` }; const next = [...p.units]; next.splice(idx + 1, 0, copy); return { ...p, units: next }; }); }}
                          onRetry={upd => { pushUndo("units", result.units); setResult(p => ({ ...p, units: p.units.map(x => x === u ? upd : x) })); }}
                          onReview={() => setReviewUnit(u.unit_number || u.name)}
                          onUndismiss={() => { pushUndo("units", result.units); setResult(p => ({ ...p, units: p.units.map(x => x === u ? { ...x, _dismissed: false } : x) })); }}
                          onDragStart={e => { setDraggingUnitKey(uid); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { setDraggingUnitKey(null); setUnitDragOverTrash(false); }}
                        />
                      );
                    })}
                    {draggingUnitKey !== null && (
                      <div
                        onDragOver={e => { e.preventDefault(); setUnitDragOverTrash(true); }}
                        onDragLeave={() => setUnitDragOverTrash(false)}
                        onDrop={e => { e.preventDefault(); pushUndo("units", result.units); setResult(p => ({ ...p, units: p.units.filter(u => (u.unit_number || u.name) !== draggingUnitKey) })); setDraggingUnitKey(null); setUnitDragOverTrash(false); }}
                        style={{ marginTop: 4, padding: "8px", border: `1.5px dashed ${unitDragOverTrash ? C.red : C.border2}`, borderRadius: 4, textAlign: "center", fontFamily: mono, fontSize: 11, color: unitDragOverTrash ? C.red : C.textFaint, background: unitDragOverTrash ? C.redBg : "transparent", transition: "all 0.1s" }}>
                        {unitDragOverTrash ? "release to delete" : "drag here to delete"}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 7, marginTop: 20, flexWrap: "wrap" }}>
                  <button onClick={saveKit} style={{ flex: "1 1 100px", padding: "10px", cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", background: "none", color: C.blue, border: `1px solid ${C.blueBorder}`, borderRadius: 4, fontFamily: mono }}>⬡ SAVE</button>
                  <button onClick={exportTxt} style={{ flex: "1 1 100px", padding: "10px", cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", background: "none", color: C.textDim, border: `1px solid ${C.border3}`, borderRadius: 4, fontFamily: mono }}>↓ EXPORT .TXT</button>
                  <button onClick={exportJson} style={{ flex: "1 1 100px", padding: "10px", cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", background: "none", color: C.textDim, border: `1px solid ${C.border3}`, borderRadius: 4, fontFamily: mono }}>↓ EXPORT .JSON</button>
                  <button onClick={resetResult} style={{ padding: "10px 13px", cursor: "pointer", fontSize: 11, fontWeight: 700, background: "none", color: C.textFaint, border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: mono }}>CLEAR UPLOADS</button>
                  <button onClick={clearAll} style={{ padding: "10px 13px", cursor: "pointer", fontSize: 11, fontWeight: 700, background: "none", color: C.textFaint, border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: mono }}>CLEAR ALL</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
