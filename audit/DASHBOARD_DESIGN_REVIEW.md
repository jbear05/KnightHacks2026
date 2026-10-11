# Watchdog dashboard design and feedback review

Reviewed October 10, 2026 against the running local Mission Report, Live, Insights and HX-217 Asset screens, their visible copy, and implementation. Recommendations only: application source and database state were not changed.

## Assessment

Operator feedback: **6/10**. Visual hierarchy and restraint: **5/10**. Visual identity: **8/10**. These are reviewer judgments, not measured task performance or official challenge grades. For this review, 5 means useful but requires interpretation, 8 means clear evidence and next steps with coherent interaction state, and 10 requires validation with representative operators.

| Feedback dimension | Score | Reason |
|---|---:|---|
| Understanding what happened | 7/10 | Failed steps and serious findings are prominent; completed mission status is distinguished from successful inspections. |
| Supporting evidence | 8/10 | Counts, denominators, asset/location IDs, timestamps, reading quality and failure causes are available. |
| Specific next step | 4/10 | “Open,” “Watch,” “Send a tech,” and generic verification advice often leave the operator to infer the appropriate investigation. |
| Uncertainty and recommendation limits | 5/10 | Questionable readings and absent normal bands are disclosed, but docking/hotspot advice is stronger than its validation. |
| Decision-state feedback | 4/10 | Saved decisions appear, but “Tech sent” overstates a database decision and “open” counts lack a lifecycle definition. |

The main clutter is repetition and competing visual emphasis, not simply too much data or too little whitespace. M014's failed-step count appears in the headline, paragraph, decorative sticker and facts strip. Insights similarly repeats its serious-finding total. Large display text, thick panel outlines, hard shadows, colored surfaces, badges, chart labels and photos all compete for attention. Headline and summary regions occupy much of the first viewport before the operator reaches evidence and decisions.

## Overall design direction

Keep the cream canvas, dark green text, friendly brand and animated robot. Concentrate the expressive treatment in the brand and robot. Use calmer surfaces and tighter hierarchy around operational information.

- Remove decorative verdict stickers that repeat adjacent numbers.
- Reduce primary page titles to roughly 28–32 px; section headings to 18–22 px; body copy to 14–16 px. Validate these sizes at the actual layouts rather than treating them as fixed requirements.
- Keep Fredoka for the wordmark and restrained page headings. Use Nunito for data and controls, with tabular numerals. Reserve monospace for IDs and timestamps; use sentence case for ordinary labels.
- Use light dividers for ordinary sections. Reserve a strong border or tint for the selected finding or attention summary; avoid nested heavily outlined cards.
- Show each headline metric once in the first viewport. Put battery and duration into compact metadata unless they affect the current decision.
- Reserve red for active critical findings or failed outcomes, amber for required attention, green for confirmed success, and a distinct labeled treatment for questionable readings. Avoid lime/pink as unexplained alternatives to those meanings.
- Display asset criticality as a labeled asset property, visually distinct from current finding severity. A critical asset is not necessarily currently experiencing a critical fault.
- Use progressive disclosure for supporting history and logs, while keeping severity, questionable quality, units, sample sizes and the next action visible.

## Screen proposals

### Mission Report — decide what needs review

Replace the oversized introductory block with a compact header: mission ID/date/configuration, “Completed with exceptions,” and “3 failed steps · 2 high-severity findings.” Below it, show the findings list immediately.

Each finding should include asset and location, severity, evidence quality, one sentence suggesting the investigation, decision state, and a primary “Review finding” action. Put a concise record-based mission explanation below the findings or in a collapsible summary. Keep AI generation secondary and move model/download explanations into help or the generation progress state.

Open evidence and decision controls together in a detail panel. Explain priority as “High finding on a critical asset,” with the numeric formula available through help; the number 12 should not be the main operator instruction. Replace the decorative route vine with a compact chronological strip or expandable action timeline. Keep links between the selected finding, its failed step, its reading, and its asset.

For M014's HX-217 finding, proposed content:

> **HX-217: review the pressure finding**  
> Gauge action timed out. The associated 128.8 psi reading was marked questionable.  
> **Suggested next step:** verify the reading before treating it as confirmed equipment evidence.  
> High-severity finding · critical asset · WP06 · M014, step 3  
> **Review evidence**

Do not relabel this as a confirmed pressure fault or infer a safe/unsafe measurement range. The source anomaly remains available even when the reading needs verification. The existing saved decision should be shown separately, rather than encouraging duplicate work.

### Live — monitor progress and exceptions

Use a compact run-status line for playback state, time, current step and battery. Label the experience “Mission replay,” including when it is reconstructed from records.

The main area should contain the map and a ranked findings panel. Default the map to the current route and relevant findings; mute unrelated waypoints, reduce background contrast, and label the current/destination waypoint and selected finding more prominently than other pins. Offer a schematic floor plan if the detailed image obscures the route. Preserve access to all waypoints and both floors.

Keep the robot, but fix the shared-clock defect before relying on its position as feedback. Put playback controls close to the map in a persistent bar. Move the complete event log into a collapsible region; initially show the latest relevant exception or selected finding's events. Remove duplicate finding badges below the map when the adjacent findings list already communicates them.

Remove the historical low-battery analysis from the default current-battery block when the robot is at 45%. Show contextual battery guidance when the current value warrants it, while keeping the thresholds and their heuristic status accessible.

Selecting a finding should highlight its actual action location and open its evidence. Replace generic “Open” labels with “Review reading,” “Review navigation failure,” or “View asset history,” according to the destination's real behavior. Use “Findings recorded” until a review-state model supports an “Awaiting review” count.

### Insights — choose where to investigate recurring problems

Use a compact title and visible date/configuration scope. Lead with at most three evidence-backed investigation prompts, each linked to the relevant records. Follow with the charts needed to compare the selected question; put additional charts under expandable analysis sections or tabs with persistent summary indicators.

Example prompts:

- **Review recurring PANEL-212 findings:** 5 recorded findings. Action: “View asset history.” This is a repeat-finding count, not an unresolved-work count or automatic highest-risk ranking.
- **Investigate acoustic-check reliability:** 13 of 43 acoustic checks failed. Action: “Review failed checks,” opening that filtered mission/action set.
- **Examine low-battery actions:** 8 of 11 failed below 20% battery. Action: “Inspect these 11 actions.” State that the sample is small and does not isolate battery as the cause.

Present V2's improvement as “Action success +13.9 percentage points,” with V1/V2 counts and the similar-route comparison accessible next to it. Do not imply causality.

Replace the large default heatmap with a short location comparison and a map toggle. Offer separately labeled rankings for finding count, action failure rate, and documented severity/criticality priority. Selecting a location should filter the actual evidence list. Keep denominators beside rates.

Remove repeated “So what” pills. Write a short finding followed by a specific destination/action. Give the explanatory sentence and the action different visual roles. An action such as “Compare similar routes” must open that comparison rather than merely tell the operator to do work elsewhere.

### Asset Detail — understand the evidence behind this asset's findings

Use an identity row with location and asset criticality. Directly below, show a concise evidence statement, such as “2 recorded high-severity findings · 1 questionable reading.” Do not turn historical findings into a current health diagnosis.

If arriving from M014's pressure finding, select the Pressure history automatically and show the relevant reading/action context first. Offer the other measurement types as tabs, each with visible quality/finding indicators; keep a summary of all important exceptions visible so tabbing does not hide them.

Label the selected and latest chart values. Make other points available through keyboard-accessible selection and a data table instead of printing every value on the chart. Put related anomalies on the same timeline and connect selection to the finding details. Use “No equipment limits supplied; this chart does not establish health status” beside the chart.

Move the sample inspection photo into a secondary “Sample imagery” region. It illustrates an inspection type and should not occupy space or emphasis intended for evidence from this asset. Keep the return-to-mission link near the top. Align real API action context with fixtures as specified in the original audit.

### Missions — find the relevant run

Complete the index as an efficient list with date, configuration, mission outcome, failed steps and serious findings. Include search, filters, and report/replay links. Keep summary counts small. Make “Completed with exceptions” easy to filter and recognize without relying on color alone.

## Feedback contract

Each recommendation should answer five questions in place:

1. **What was observed?** Use a specific action, finding or count.
2. **Why investigate it?** Name the severity, recurrence, affected asset or reliability issue.
3. **What should happen next?** Give an explicit action that opens the relevant evidence or records a recommendation.
4. **What is uncertain?** Identify questionable readings, missing limits, small samples and unvalidated heuristics.
5. **What happened after the operator acted?** Show pending, saved and failed states with consistent terminology.

Use “Recommend inspection” → “Inspection recommendation saved” rather than “Send a tech” → “Tech sent” while the app only records a decision. “Watch” should be explained as a saved monitoring choice; do not imply scheduled reminders or active monitoring without those capabilities. Make the selected decision visible with “Change decision.” Preserve the finding for investigation history; do not silently imply equipment resolution.

Save feedback should be visible inline: “Decision saved for HX-217.” During a save, show “Saving decision…”; on failure, show “Decision was not saved. Retry.” Preserve the operator's intended choice where practical, and never show success before server confirmation. Include the asset/finding identity so messages cannot be mistaken for another row's state.

## Priority and validation

First remove duplicated verdicts and compress headers. Then put finding evidence and actions together, fix truthful decision/queue state, and synchronize replay. Next add linked Insights investigation prompts and focused asset measurement views. Simplify maps and secondary logs after those paths work.

Proposed acceptance targets, not established performance gains:

- At 1280 × 800, the primary finding and its action are visible without scrolling on Report and Asset Detail.
- Important findings retain severity, evidence quality and decision state when supporting details are collapsed.
- At 375 px wide, there is no page-level horizontal overflow; intentional chart/timeline scrolling remains scoped and labeled.
- A representative operator can identify the primary issue within 5 seconds and reach its supporting evidence within 15 seconds. Test these targets with 3–5 people and record errors as well as time; do not generalize that small check into validated productivity gains.
- Compare the old and proposed flows using the same M014 case: identify the issue, explain the evidence limitation, choose a recommendation, save it, and confirm it after reload. Counterbalance presentation order where possible to reduce learning effects.
- All decision controls, chart selections and detail panels remain keyboard accessible, with visible focus and correctly returned focus when closing panels.
- Historical findings, awaiting-review counts and saved recommendations are distinct. No color, badge, or action label implies an unsupported health assessment, dispatched worker, scheduled follow-up or resolved fault.
