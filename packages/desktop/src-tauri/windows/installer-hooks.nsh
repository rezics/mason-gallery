!include "LogicLib.nsh"
!include "nsDialogs.nsh"

Var ShellIntegrationPageInitialized
Var ShellFoldersCheckbox
Var ShellArchivesCheckbox
Var ShellFoldersSelected
Var ShellArchivesSelected

LangString ShellIntegrationTitle ${LANG_ENGLISH} "System integration"
LangString ShellIntegrationSubtitle ${LANG_ENGLISH} "Choose where MasonGallery appears in File Explorer."
LangString ShellIntegrationDescription ${LANG_ENGLISH} "These optional commands appear in the classic context menu under Show more options. They do not change your default apps."
LangString ShellIntegrationFolders ${LANG_ENGLISH} "Add 'Open with MasonGallery' for folders"
LangString ShellIntegrationArchives ${LANG_ENGLISH} "Add 'Open with MasonGallery' for ZIP, RAR, 7Z, CBZ, and CBR files"

LangString ShellIntegrationTitle ${LANG_SIMPCHINESE} "系统集成"
LangString ShellIntegrationSubtitle ${LANG_SIMPCHINESE} "选择 MasonGallery 在文件资源管理器中的显示位置。"
LangString ShellIntegrationDescription ${LANG_SIMPCHINESE} "这些可选命令会显示在“显示更多选项”下的经典右键菜单中，不会更改默认应用。"
LangString ShellIntegrationFolders ${LANG_SIMPCHINESE} "为文件夹添加“使用 MasonGallery 打开”"
LangString ShellIntegrationArchives ${LANG_SIMPCHINESE} "为 ZIP、RAR、7Z、CBZ 和 CBR 文件添加“使用 MasonGallery 打开”"

LangString ShellIntegrationTitle ${LANG_TRADCHINESE} "系統整合"
LangString ShellIntegrationSubtitle ${LANG_TRADCHINESE} "選擇 MasonGallery 在檔案總管中的顯示位置。"
LangString ShellIntegrationDescription ${LANG_TRADCHINESE} "這些選用指令會顯示在「顯示更多選項」下的傳統右鍵選單中，不會變更預設應用程式。"
LangString ShellIntegrationFolders ${LANG_TRADCHINESE} "為資料夾加入「使用 MasonGallery 開啟」"
LangString ShellIntegrationArchives ${LANG_TRADCHINESE} "為 ZIP、RAR、7Z、CBZ 和 CBR 檔案加入「使用 MasonGallery 開啟」"

LangString ShellIntegrationTitle ${LANG_JAPANESE} "システム連携"
LangString ShellIntegrationSubtitle ${LANG_JAPANESE} "エクスプローラーで MasonGallery を表示する場所を選択します。"
LangString ShellIntegrationDescription ${LANG_JAPANESE} "これらのオプションコマンドは「その他のオプションを表示」にある従来のコンテキストメニューへ追加されます。デフォルトアプリは変更しません。"
LangString ShellIntegrationFolders ${LANG_JAPANESE} "フォルダーに「MasonGallery で開く」を追加"
LangString ShellIntegrationArchives ${LANG_JAPANESE} "ZIP、RAR、7Z、CBZ、CBR ファイルに「MasonGallery で開く」を追加"

Page custom ShellIntegrationPageCreate ShellIntegrationPageLeave

Function ShellIntegrationPageCreate
  ClearErrors
  ${GetOptions} $CMDLINE "/UPDATE" $0
  ${IfNot} ${Errors}
    Abort
  ${EndIf}
  ClearErrors
  ${GetOptions} $CMDLINE "/P" $0
  ${IfNot} ${Errors}
    Abort
  ${EndIf}

  ${If} $ShellIntegrationPageInitialized != 1
    StrCpy $ShellFoldersSelected 0
    StrCpy $ShellArchivesSelected 0
    ReadRegStr $0 HKCU "Software\Classes\Directory\shell\MasonGallery\command" ""
    ${If} $0 != ""
      StrCpy $ShellFoldersSelected 1
    ${EndIf}
    ReadRegStr $0 HKCU "Software\Classes\SystemFileAssociations\.zip\shell\MasonGallery\command" ""
    ${If} $0 != ""
      StrCpy $ShellArchivesSelected 1
    ${EndIf}
    StrCpy $ShellIntegrationPageInitialized 1
  ${EndIf}

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "$(ShellIntegrationTitle)" "$(ShellIntegrationSubtitle)"
  ${NSD_CreateLabel} 0 0 100% 36u "$(ShellIntegrationDescription)"
  Pop $0
  ${NSD_CreateCheckbox} 0 48u 100% 14u "$(ShellIntegrationFolders)"
  Pop $ShellFoldersCheckbox
  ${NSD_CreateCheckbox} 0 72u 100% 28u "$(ShellIntegrationArchives)"
  Pop $ShellArchivesCheckbox

  ${If} $ShellFoldersSelected == 1
    ${NSD_Check} $ShellFoldersCheckbox
  ${EndIf}
  ${If} $ShellArchivesSelected == 1
    ${NSD_Check} $ShellArchivesCheckbox
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function ShellIntegrationPageLeave
  ${NSD_GetState} $ShellFoldersCheckbox $ShellFoldersSelected
  ${NSD_GetState} $ShellArchivesCheckbox $ShellArchivesSelected
FunctionEnd

!macro RemoveMasonGalleryFolderIntegration
  DeleteRegKey HKCU "Software\Classes\Directory\shell\MasonGallery"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\MasonGallery"
!macroend

!macro RemoveMasonGalleryArchiveIntegration
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.zip\shell\MasonGallery"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.rar\shell\MasonGallery"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.7z\shell\MasonGallery"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.cbz\shell\MasonGallery"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.cbr\shell\MasonGallery"
  DeleteRegKey HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe"
!macroend

!macro InstallMasonGalleryFolderIntegration
  WriteRegStr HKCU "Software\Classes\Directory\shell\MasonGallery" "" "$(ShellIntegrationFolders)"
  WriteRegStr HKCU "Software\Classes\Directory\shell\MasonGallery" "Icon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
  WriteRegStr HKCU "Software\Classes\Directory\shell\MasonGallery\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" --shell-open $\"%1$\""
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\MasonGallery" "" "$(ShellIntegrationFolders)"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\MasonGallery" "Icon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\MasonGallery\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" --shell-open $\"%V$\""
!macroend

!macro InstallMasonGalleryArchiveVerb EXTENSION
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXTENSION}\shell\MasonGallery" "" "$(ShellIntegrationArchives)"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXTENSION}\shell\MasonGallery" "Icon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXTENSION}\shell\MasonGallery\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" --shell-open $\"%1$\""
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" "${EXTENSION}" ""
!macroend

!macro InstallMasonGalleryArchiveIntegration
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe" "FriendlyAppName" "MasonGallery"
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" --shell-open $\"%1$\""
  !insertmacro InstallMasonGalleryArchiveVerb ".zip"
  !insertmacro InstallMasonGalleryArchiveVerb ".rar"
  !insertmacro InstallMasonGalleryArchiveVerb ".7z"
  !insertmacro InstallMasonGalleryArchiveVerb ".cbz"
  !insertmacro InstallMasonGalleryArchiveVerb ".cbr"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ClearErrors
  ${GetOptions} $CMDLINE "/UPDATE" $0
  ${If} ${Errors}
    ${If} $ShellFoldersSelected == ${BST_CHECKED}
      !insertmacro InstallMasonGalleryFolderIntegration
    ${Else}
      !insertmacro RemoveMasonGalleryFolderIntegration
    ${EndIf}
    ${If} $ShellArchivesSelected == ${BST_CHECKED}
      !insertmacro InstallMasonGalleryArchiveIntegration
    ${Else}
      !insertmacro RemoveMasonGalleryArchiveIntegration
    ${EndIf}
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode != 1
    !insertmacro RemoveMasonGalleryFolderIntegration
    !insertmacro RemoveMasonGalleryArchiveIntegration
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${EndIf}
!macroend
