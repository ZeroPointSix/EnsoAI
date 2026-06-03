; Dev channel — register enso-dev:// only (never enso://)

!macro customInstall
  WriteRegStr HKCU "Software\Classes\enso-dev" "" "URL:EnsoAIPlus Dev Protocol"
  WriteRegStr HKCU "Software\Classes\enso-dev" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\enso-dev\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\enso-dev"
!macroend
