; Preview / CI builds — separate URL scheme from production enso://

!macro customInstall
  WriteRegStr HKCU "Software\Classes\enso-preview" "" "URL:EnsoAIPlus Preview Protocol"
  WriteRegStr HKCU "Software\Classes\enso-preview" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\enso-preview\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\enso-preview"
!macroend
