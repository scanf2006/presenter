!macro NSIS_HOOK_POSTINSTALL
  CreateShortCut "$DESKTOP\ChurchDisplay Pro.lnk" "$INSTDIR\app.exe" "" "$INSTDIR\app.exe" 0
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$DESKTOP\ChurchDisplay Pro.lnk"
!macroend
