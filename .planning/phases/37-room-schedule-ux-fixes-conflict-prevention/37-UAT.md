---
status: complete
phase: 37-room-schedule-ux-fixes-conflict-prevention
source: 37-01-SUMMARY.md, 37-02-SUMMARY.md, 37-03-SUMMARY.md, 37-04-SUMMARY.md
started: 2026-03-03T19:30:00Z
updated: 2026-03-03T19:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cell shows 3 lines of info without hover
expected: Each activity cell displays teacher name, student/group label, and time range on 3 separate lines — readable without hovering.
result: pass

### 2. Activity type accent borders
expected: Each cell has a thick colored right border identifying its type: blue for private lessons, purple for rehearsals, orange for theory classes.
result: issue
reported: "right now in the db we dont have any scheduled theory lessons or orchestral reheasals only private lessons but for the lessons we can see the thick colored right border, but it can be more noticable and put more attention. not so good."
severity: minor

### 3. Filter toggle on/off states
expected: Activity type filter buttons show clear visual difference between on and off. Active filters look bold/elevated. Inactive filters show strikethrough (line-through) text.
result: pass

### 4. Drag-and-drop conflict feedback
expected: When dragging an activity, valid drop targets show a green highlight/ring. Slots that would cause a room conflict show a red highlight/ring. You cannot drop onto a red-highlighted cell.
result: issue
reported: "the drag is working but can be improved in much more smooth animation. the target zone is not good - when i drop the item it refreshed the whole page and bring me back up and i lost my spot i changed it is bad ux - also it seems that the item wasnt recieved by the target cell. so this is a critical bug there. also - we still have many conflicts in the schedules that were created by the seed file for students-teachers schedules - so maybe we need to clear the db from the data that has been seeded and fix this script to upload new one without all the conflicts. then we can test the system again - right now we still have many התנגשויות so this really confusing because the app should not allowed this to be created in the first place. should sent a warning message that this operation is not allowed and denied the request and show a proper message to him - or in the table with the drop function that cannot allow the user to drag the item to an occupied cell."
severity: blocker

### 5. Create dialog conflict prevention
expected: When creating a new lesson, if the selected room+time conflicts with an existing activity OR the selected teacher is already booked at that time, a Hebrew warning message appears and the submit button is disabled.
result: issue
reported: "in the teacher input we got strange placeholder showing raw unicode escapes. it needs to give me to filter text upon teachers list. the student is nice but could be easier to make a filter text typing input. the warning works correctly for students who have already conflicts which is good. but teacher conflict check failed."
severity: major

### 6. Fullscreen mode
expected: Clicking the fullscreen button in the toolbar opens the room schedule in a new browser tab at /room-schedule/fullscreen — no sidebar, no header, just the grid. An exit button is visible to return.
result: issue
reported: "it still quiet small - you removed the header and sidebar but the table still not so much functionality and not so ux good. the overall interact with the table feeling right now cumbersome and ungainly. we need to let the user a better interaction with it. need really big improvement in design this table in a better way. critical."
severity: blocker

### 7. Grid-style PDF export
expected: Clicking "PDF חזותי" downloads a landscape PDF that mirrors the on-screen grid: rooms as rows, time slots as columns, cells color-coded by activity type (blue/purple/orange).
result: issue
reported: "שגיאה בייצוא PDF - not working either טבלאי or חזותי - still got error and not working. no error in the terminal or either in the console logs."
severity: blocker

### 8. Tabular PDF export
expected: Clicking "PDF טבלאי" downloads a PDF with a data table listing activities with columns for room, teacher, student/group, time, and type.
result: issue
reported: "not working."
severity: blocker

### 9. Week PDF export
expected: In week view mode, exporting PDF produces a single file with 6 pages (Sunday through Friday), one page per day.
result: issue
reported: "failed. not working"
severity: blocker

### 10. Filter-aware PDF export
expected: When filters are active (e.g. only "rehearsals" toggled on, or a specific teacher filtered), the exported PDF contains only the filtered data — not the full unfiltered schedule.
result: issue
reported: "it works only when the table is empty... so it failed also."
severity: blocker

## Summary

total: 10
passed: 2
issues: 8
pending: 0
skipped: 0

## Gaps

- truth: "Each cell has a thick colored accent border that clearly identifies activity type"
  status: failed
  reason: "User reported: accent border visible but not noticeable enough, needs more attention"
  severity: minor
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Drag-and-drop moves activity to target cell with green/red conflict feedback"
  status: failed
  reason: "User reported: drop refreshes entire page, scrolls to top, item not received by target cell. Seed data still has many conflicts. App should prevent conflicts entirely."
  severity: blocker
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Create dialog shows teacher conflict warning with Hebrew text and blocks submission"
  status: failed
  reason: "User reported: teacher input shows raw unicode escapes instead of Hebrew placeholder, needs filterable text input, teacher conflict check failed"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Fullscreen mode provides a usable, well-designed grid experience filling the screen"
  status: failed
  reason: "User reported: table still small, poor UX, cumbersome and ungainly interaction, needs big improvement in table design"
  severity: blocker
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Grid-style PDF export downloads a color-coded landscape PDF"
  status: failed
  reason: "User reported: שגיאה בייצוא PDF - not working, no error in terminal or console"
  severity: blocker
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Tabular PDF export downloads a data table PDF"
  status: failed
  reason: "User reported: not working"
  severity: blocker
  test: 8
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Week PDF produces 6-page single file"
  status: failed
  reason: "User reported: failed, not working"
  severity: blocker
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Filter-aware PDF exports only filtered data"
  status: failed
  reason: "User reported: works only when table is empty"
  severity: blocker
  test: 10
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
