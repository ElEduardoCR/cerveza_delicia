# Scroll regression checks

Reproduced before fix at 666 × 1029: clicking “Encuentra tu Delicia” stopped with Pionera 149 px below the viewport top and description opacity 0.725584. Bottle entrance had already reached its final pose, followed by a long inactive sticky interval.

Verified after fix:
- 666 × 1029: primary link aligns Pionera at top 0, description reaches opacity 1 without more scroll.
- Continuing 154.5 px changes bottle rotateY from −2.4994° to 1.25364° while text stays at opacity 1.
- 1440 × 900: next link aligns Monito at top 0, description opacity 1; no horizontal overflow.

Text reveal now completes in time independently of scroll position. Bottle animation ends at the real sticky release boundary, with no middle plateau. Progress uses that same bounded timeline, avoiding division by zero for non-sticky scenes.
- 390 × 667: panels use normal flow; visible descriptions reach opacity 1, completed progress is scaleX(1), transforms remain finite, and there is no horizontal overflow.
- Followed all five product links through the final section successfully.
