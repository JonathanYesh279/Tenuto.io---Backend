---
status: diagnosed
phase: 37-room-schedule-ux-fixes-conflict-prevention
source: 37-01-SUMMARY.md, 37-02-SUMMARY.md, 37-03-SUMMARY.md, 37-04-SUMMARY.md
started: 2026-03-03T19:30:00Z
updated: 2026-03-03T20:00:00Z
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
  root_cause: "border-r-4 (4px right border) is too subtle; gets lost among cell borders and bg color. In RTL layout the right border is the start edge. Needs wider border or additional visual cue like colored background tint or left+right accent."
  artifacts:
    - path: "src/components/room-schedule/ActivityCell.tsx"
      issue: "borderAccent uses border-r-4 which is too thin to stand out"
  missing:
    - "Increase accent border width to 6-8px or add colored left border too"
    - "Consider adding a light background tint per type for stronger identification"
  debug_session: ""

- truth: "Drag-and-drop moves activity to target cell with green/red conflict feedback"
  status: failed
  reason: "User reported: drop refreshes entire page, scrolls to top, item not received by target cell. Seed data still has many conflicts."
  severity: blocker
  test: 4
  root_cause: "TWO ROOT CAUSES: (1) handleDragEnd calls loadSchedule() which sets loading=true, unmounting the entire grid and showing skeleton. When data returns, grid re-renders from scratch losing scroll position. No optimistic UI update. (2) Seed data has room-time conflicts because generateTeachers/generateRehearsals/generateTheoryLessons all use pick(LOCATIONS) randomly with no global room-occupancy tracking across 27 rooms."
  artifacts:
    - path: "src/pages/RoomSchedule.tsx"
      issue: "handleDragEnd (line 248) calls loadSchedule() which sets loading=true, unmounts grid, loses scroll position"
    - path: "src/pages/RoomSchedule.tsx"
      issue: "loadSchedule (line 182) sets loading=true causing full grid unmount/remount"
    - path: "scripts/seed-dev-data.js"
      issue: "generateTeachers, generateRehearsals, generateTheoryLessons all use pick(LOCATIONS) with no room-occupancy tracking"
  missing:
    - "Add optimistic state update in handleDragEnd before API call, or skip loading=true on refresh"
    - "Preserve scroll position across schedule reloads (ref on scroll container)"
    - "Add room-occupancy tracking Map to seed script with pickNonConflictingRoom helper"
    - "Re-seed DB after fixing seed script"
  debug_session: ""

- truth: "Create dialog shows teacher conflict warning with Hebrew text and blocks submission"
  status: failed
  reason: "User reported: teacher input shows raw unicode escapes instead of Hebrew placeholder, needs filterable text input, teacher conflict check failed"
  severity: major
  test: 5
  root_cause: "TWO ROOT CAUSES: (1) Teacher search input placeholder uses JSX attribute string with unicode escapes (placeholder='...\\u05D7...') which may not be interpreted by the bundler. All other Hebrew strings in the file use JSX expression syntax ({'\u05D7...'}) which works. (2) Teacher conflict check logic is correct but may fail due to teacherId mismatch between schedule data and teacher list (ObjectId string comparison) or because seed data lacks teacher double-booking scenarios to test."
  artifacts:
    - path: "src/components/room-schedule/CreateLessonDialog.tsx"
      issue: "Line 227: placeholder uses attribute string with unicode escapes instead of JSX expression"
    - path: "src/components/room-schedule/CreateLessonDialog.tsx"
      issue: "Lines 118-131: teacher conflict check depends on activity.teacherId matching teacher._id"
  missing:
    - "Change placeholder to use JSX expression: placeholder={'\u05D7\u05D9\u05E4\u05D5\u05E9 \u05DE\u05D5\u05E8\u05D4...'}"
    - "Add console.log to verify teacherId values match between schedule data and teacher list"
    - "Verify seed data creates scenarios where a teacher teaches in multiple rooms at same time"
  debug_session: ""

- truth: "Fullscreen mode provides a usable, well-designed grid experience filling the screen"
  status: failed
  reason: "User reported: table still small, poor UX, cumbersome and ungainly interaction, needs big improvement in table design"
  severity: blocker
  test: 6
  root_cause: "THREE ROOT CAUSES: (1) RoomGrid has max-h-[calc(100vh-280px)] (line 169 of RoomGrid.tsx) which caps vertical height even in fullscreen mode. (2) RoomScheduleFullscreen wraps <RoomSchedule /> but passes no isFullscreen prop, so the grid renders identically to sidebar view with same constraints. (3) Grid columns use minmax(120px, 1fr) which doesn't expand aggressively in a wider viewport; the overall page has p-6 padding reducing available space."
  artifacts:
    - path: "src/components/room-schedule/RoomGrid.tsx"
      issue: "Line 169: max-h-[calc(100vh-280px)] limits height regardless of context"
    - path: "src/pages/RoomScheduleFullscreen.tsx"
      issue: "Wraps RoomSchedule with p-4 padding but doesn't signal fullscreen mode"
    - path: "src/pages/RoomSchedule.tsx"
      issue: "p-6 padding and no fullscreen-aware layout adjustments"
  missing:
    - "Add isFullscreen prop to RoomSchedule and RoomGrid"
    - "In fullscreen: remove max-h constraint, use h-screen minus exit bar, reduce padding"
    - "In fullscreen: expand column min-width or use flexible sizing"
    - "Consider auto-hiding toolbar/filters in fullscreen for maximum grid space"
  debug_session: ""

- truth: "Grid-style PDF export downloads a color-coded landscape PDF"
  status: failed
  reason: "User reported: שגיאה בייצוא PDF - not working, no error in terminal or console"
  severity: blocker
  test: 7
  root_cause: "jsPDF default font (Helvetica) does not include Hebrew character metrics. When autoTable calls getStringUnitWidth() to measure Hebrew cell content for column sizing, it fails/throws. The catch block (line 533) shows toast.error but does NOT console.error the actual exception, hiding the real error. Works when table is empty because no Hebrew text enters autoTable cells."
  artifacts:
    - path: "src/pages/RoomSchedule.tsx"
      issue: "Lines 431-536: handleExportGridPDF uses default jsPDF font with no Hebrew font loaded"
    - path: "src/pages/RoomSchedule.tsx"
      issue: "Lines 533-535: catch block swallows error without console.error"
  missing:
    - "Load a Hebrew-supporting font (Rubik, Noto Sans Hebrew, or David) into jsPDF via doc.addFont()"
    - "Set the loaded font as active before any text/table rendering"
    - "Add console.error(err) to all catch blocks for debugging"
  debug_session: ""

- truth: "Tabular PDF export downloads a data table PDF"
  status: failed
  reason: "User reported: not working"
  severity: blocker
  test: 8
  root_cause: "Same root cause as test 7: jsPDF default font lacks Hebrew character metrics. handleExportTabularPDF (line 361) has same issue. catch block at line 425 also swallows errors."
  artifacts:
    - path: "src/pages/RoomSchedule.tsx"
      issue: "Lines 361-428: handleExportTabularPDF uses default jsPDF font, catch swallows error"
  missing:
    - "Same fix as test 7: load Hebrew font, set active, add error logging"
  debug_session: ""

- truth: "Week PDF produces 6-page single file"
  status: failed
  reason: "User reported: failed, not working"
  severity: blocker
  test: 9
  root_cause: "Same root cause as tests 7-8. Week PDF calls the same export functions in a loop. The Hebrew font issue causes failure on the first page with data."
  artifacts:
    - path: "src/pages/RoomSchedule.tsx"
      issue: "Week PDF shares the same font-less jsPDF instance"
  missing:
    - "Same fix as tests 7-8"
  debug_session: ""

- truth: "Filter-aware PDF exports only filtered data"
  status: failed
  reason: "User reported: works only when table is empty"
  severity: blocker
  test: 10
  root_cause: "Same root cause as tests 7-9. Filter logic is correct (applyFilters is reused) but PDF generation fails when any filtered data contains Hebrew text. When table is empty, no Hebrew enters autoTable, so the PDF generates successfully."
  artifacts:
    - path: "src/pages/RoomSchedule.tsx"
      issue: "applyFilters works correctly but the downstream PDF rendering fails on Hebrew content"
  missing:
    - "Same fix as tests 7-9: Hebrew font support in jsPDF"
  debug_session: ""
