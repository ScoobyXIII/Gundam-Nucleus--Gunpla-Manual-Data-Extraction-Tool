# Gundam Nucleus — User Tutorial

This guide walks through every feature in Gundam Nucleus from upload to export.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Kit Info](#kit-info)
3. [Uploading Manual Pages](#uploading-manual-pages)
4. [Running Extraction](#running-extraction)
5. [Runners](#runners)
6. [Polycaps](#polycaps)
7. [Assembly Units](#assembly-units)
8. [Review Flags](#review-flags)
9. [Saving and Exporting](#saving-and-exporting)
10. [Saved Kits Tab](#saved-kits-tab)
11. [Undo](#undo)
12. [Keyboard Shortcuts](#keyboard-shortcuts)
13. [Tips and Notes](#tips-and-notes)

---

## Getting Started

Gundam Nucleus runs as a Claude Projects artifact. To launch it:

1. Go to [claude.ai](https://claude.ai) and create a new **Project** (not a regular chat)
2. Upload `GundamNucleus.jsx` into the project
3. Start a conversation and prompt: **"Run Gundam Nucleus"**

Claude will render the tool in its sandbox. You'll land on the **Extract** tab.

> **Try it first:** Hit the **DEMO** button in the top-right corner to load a sample kit (ORB-01 Akatsuki Gundam) and explore the interface before uploading real pages.

---

## Kit Info

Before uploading, fill in the kit metadata fields at the top of the Extract tab:

| Field | Example |
|---|---|
| Kit Name | Nu Gundam Ver Ka |
| Brand | Bandai |
| Grade | MG |
| Scale | 1/100 |
| Mfg Date | 12/2012 |

These fields are optional but they carry through to your exports and saved kit library. You can edit them at any time.

---

## Uploading Manual Pages

GN has three separate upload zones. Each accepts image files (JPG, PNG, etc.) or PDFs.

### Runner Pages
Photos or scans of the **runner inventory pages** — the pages showing each runner with its part numbers laid out on the sprue. These use the header format `[letter]パーツ (___樹脂：___)` near each runner image.

### Index Page
The **kit overview page** showing the full assembled model with numbered unit labels (e.g. `《頭部》2`, `《ボディ》1`). This is optional but helps GN correctly name your assembly units. Upload one image here.

### Assembly Pages
The **step-by-step instruction pages** showing how parts go together. Each assembly step box has a bold unit number in its top-left corner.

**File ordering note:** GN sorts uploaded files by the number in their filename (e.g. `page_03.jpg` before `page_10.jpg`). Rename your files numerically if order matters. That said, the extraction model also uses internal page numbers and step numbers from within the images themselves, so out-of-order uploads are generally handled correctly.

**Upload undo:** If you accidentally add the wrong file, press `Ctrl+Z` (or `Cmd+Z`) before extracting to undo the upload.

---

## Running Extraction

Once your files are uploaded, click **EXTRACT**. GN sends your images to the Claude API and extracts:

- All runners and their part numbers
- Polycap runners
- Assembly unit breakdowns with parts assigned per unit

A loading message will display while extraction runs. Larger uploads with many pages will take longer.

**Retry zones:** If extraction missed something, you don't have to re-run the whole thing. Runner Pages, Indexes, and assembly pages each have their own retry function.
Once extraction completes, runners and units will have their own sections with individual controls and retry upload functions.
 (covered below).

---

## Runners

After extraction, the **Runners** section shows a card for each runner found in the manual.

### Runner Card — Collapsed View

Each card shows:
- **Runner label** (e.g. `A`, `B`, `C1`, `C2`) as a clickable button
- **Quantity indicator** (e.g. `×2`) if the runner appears more than once in the kit
- **Material chip** showing PS, ABS, PE, PVC, or POM — click it to change

**Interactions on a collapsed card:**
- **Click the label button** — expand the card to edit parts
- **Double-click the card** — duplicate the runner
- **Double-right-click the card** — delete the runner (with confirmation)
- **Drag the card** — a trash zone appears at the bottom; drag onto it to delete

### Runner Card — Expanded View

Click the label to expand. You'll see the runner's part circles laid out in a grid.

**Part circles:**
- **Filled/bright** = part is active (used in this kit variant)
- **Dim** = part is inactive (crossed out or unused in this variant)
- **Click** — toggle active/inactive
- **Double-click** — duplicate the part
- **Right-click** — open inline edit to rename the part number
- **Double-right-click** — delete the part
- **Drag** — a trash zone appears; drag onto it to delete

**`+` circle** at the end of the row — click to add the next sequential part number automatically. Right-click the `+` to type a custom part number instead.

**Duplicate runner button** — for kits where the same runner is included twice in the box (e.g. runner `D ×2`). Adds a second sub-runner entry under the same label. Each physical runner can have its own independent part list (useful when one has inactive parts the other doesn't). Max 8 duplicates per runner label.

**Undo within an expanded runner:** `Ctrl+Z` / `Cmd+Z` undoes the last change to that runner's parts while it's expanded.

**Material picker:** Click the material chip in the header to change it. Options: PS, ABS, PE, PVC, POM. Hit `clear` at the bottom of the dropdown to set it to unknown.

### Adding a Runner Manually

Click **+ ADD** in the Runners section header. A dialog will prompt you to enter a part number range (e.g. `1–33`). This creates a new runner pre-populated with every part number in that range. Click outside the dialog to create an empty runner instead.

### Retry (Runners)

If the runner extraction was incomplete or wrong, click **RETRY RUNNERS** (appears in the Runners section header area after extraction). Upload the specific runner page images again and GN will re-extract just the runner data and merge it with your existing result.

---

## Polycaps

The **Polycaps** section shows polycap runners (PC, PCA, PCB, etc.) separately from plastic runners.

Each polycap card shows the label and quantity. You can:
- Edit the label inline
- Adjust the quantity
- Duplicate the card (double-click)
- Delete it (double-right-click or drag to trash)

Click **+ ADD** in the section header to add a polycap entry manually.

---

## Assembly Units

The **Assembly Units** section shows each assembly unit extracted from your instruction pages — HEAD, BODY, WAIST, etc. — with all parts assigned to that unit.

### Unit Card — Collapsed View

Each card shows:
- Unit name
- Part count and runner letters used (e.g. `12 parts · A B C`)
- Any attached note

**Interactions:**
- **Click the card header** — expand to edit
- **Double-click** — duplicate the unit
- **Double-right-click** — delete (with confirmation)
- **Drag** — trash zone appears at bottom

### Unit Card — Expanded View

Click a card to expand it. Inside you can:

**Edit the unit name** — click the name to make it editable inline. Press Enter or click away to confirm.

**Add a note** — click `+ note` to attach a free-text note (e.g. "L/R identical"). Click the note text to edit it.

**Parts chips** — each part is shown as a chip:
- **Click** — toggle active/inactive
- **Double-click** — duplicate
- **Right-click** — inline edit to rename
- **Double-right-click** — delete
- **Drag** — trash zone appears

**`+` chip** — adds a new part. Click to open a text input and type a part number (e.g. `A7`, `PCa`).

**runners_used** is recalculated automatically whenever you add, remove, or toggle a part — it reads the letter prefix from each active part number.

### Per-Unit Retry

Each unit card has a **RETRY** button in the expanded view. Use this when a unit's parts were extracted incorrectly. Upload the specific assembly pages for that unit, optionally adjust the unit name that GN will search for, and hit **RETRY**. This re-extracts just that one unit without touching the rest of your data.

### Adding a Unit Manually

Click **+ ADD** in the Assembly Units section header. A blank unit named `NEW UNIT` is created and auto-expanded so you can start editing immediately.

---

## Review Flags

Some assembly steps are ambiguous — join steps where completed subassemblies are combined, sometimes with a few new parts attached. GN flags these as **needs review** rather than silently assigning parts to the wrong unit.

Flagged units appear as **amber warning cards** at the top of the Assembly Units list. The card shows the unit name and how many parts need to be assigned.

**Click a flagged card** to open the **Review Overlay**. Inside:

- The flagged unit's parts are shown in a box
- Your existing confirmed units are shown underneath
- **Assign all parts** — click a confirmed unit card to merge all flagged parts into it
- **Assign individual parts** — click and drag to the target unit to send just that part

Once all parts are assigned, the flagged unit is removed automatically.

**Dismiss** — if you've reviewed it and decided the extraction is actually fine as-is, click **Dismiss** to clear the flag without reassigning anything. A dismissed unit behaves like a normal unit and moves to the bottom of the list.

---

## Saving and Exporting

At the bottom of the results panel:

**⬡ SAVE** — saves the current kit (including all edits) to the in-session **Saved Kits** library. If there are unresolved review flags, you'll get a warning first. You can save anyway or go back and resolve them.

**↓ EXPORT .TXT** — downloads a plain text summary of the kit: name, metadata, runner list with ranges and part counts, and full unit breakdowns.

**↓ EXPORT .JSON** — downloads the full kit data as a structured JSON file. This is the format intended for Veda database intake (schema mapping in progress).

**CLEAR UPLOADS** — removes the uploaded files and extraction result, but keeps your kit metadata fields filled in.

**CLEAR ALL** — resets everything including kit metadata.

---

## Saved Kits Tab

Switch to the **Saved** tab to view all kits saved in the current session. Each saved entry shows:

- Kit name, grade, scale, and brand
- Save timestamp
- Runner count and unit count
- Export buttons (.TXT and .JSON) to re-download at any time

> **Note:** Saved kits are session-only. They do not persist after you close or refresh the Claude Projects sandbox. Export your JSON before closing if you need to keep the data.

---

## Undo

GN has multi-level undo across several scopes:

| Context | How to undo |
|---|---|
| Upload changes (before extraction) | `Ctrl+Z` / `Cmd+Z` |
| Runner parts (expanded card) | `Ctrl+Z` / `Cmd+Z` while card is expanded |
| Runner section edits | Click **↩ UNDO** in the Runners section header |
| Polycap section edits | Click **↩ UNDO** in the Polycaps section header |
| Unit section edits | Click **↩ UNDO** in the Assembly Units section header |
| Global (units → runners → polycaps) | `Ctrl+Z` / `Cmd+Z` anywhere |

Up to 10 states are stored per undo stack.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Z` / `Cmd+Z` | Undo (context-sensitive) |
| `Enter` | Confirm inline text edits |
| `Escape` | Cancel inline text edits |

---

## Tips and Notes

**Image quality matters.** The extraction model reads part numbers directly from your images. Clear, well-lit photos with minimal glare give the best results. Avoid extreme angles. Copying/ saving the full sized images from Dalong is helpful here.

**Upload order.** Name your files numerically if possible (e.g. `01.jpg`, `02.jpg`). GN sorts by the first number it finds in the filename.

**Duplicate runners.** If your kit includes the same runner twice (e.g. runner `D ×2`), GN should detect this and create a single runner entry with quantity 2 and two sub-runner part lists. If it doesn't, you can add the duplicate manually using **+ DUPLICATE RUNNER** inside the expanded card, or double clicking the header.

**Variant kits.** Parts marked inactive (crossed out in the manual) represent parts unused in this specific variant. GN preserves these as `active: false` in the data rather than discarding them.

**Polycap callouts in units.** Parts like `PC(x2)` or `PCc` in unit assembly steps are valid callouts and should appear in your unit parts list. GN extracts these as strings — they won't resolve to a runner letter but they're preserved in the output.

**The DEMO button** loads a full sample dataset (ORB-01 Akatsuki NG 1/100) so you can explore the UI without uploading anything. Runner D is included as a duplicate runner with one variant part inactive, which lets you see how that case is displayed.
