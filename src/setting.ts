export enum NothingSelected {
  doNothing = 'doNothing',
  autoSelect = 'autoSelect',
  insertInline = 'insertInline',
  insertBare = 'insertBare',
}

export interface ImgurPluginSettings {
  // Core plugin settings
  uploadStrategy: string
  clientId: string
  showRemoteUploadConfirmation: boolean
  albumToUpload: string | undefined

  // URL handling settings
  nothingSelected: NothingSelected
  regex: string
  listForImgEmbed: string
  convertSelectionToHyperlink: boolean
  pasteUrlOntoSelection: boolean
}

export const DEFAULT_SETTINGS: ImgurPluginSettings = {
  // Core plugin defaults
  uploadStrategy: 'anonymous-imgur',
  clientId: null,
  showRemoteUploadConfirmation: true,
  albumToUpload: undefined,

  // URL handling defaults
  nothingSelected: NothingSelected.doNothing,
  regex: '^(?:https?://)?(?:www\\.)?[^\\s/$.?#].[^\\s]*$',
  listForImgEmbed: '\\.(gif|jpe?g|tiff?|png|webp|bmp)$\nimgur\\.com',
  convertSelectionToHyperlink: true,
  pasteUrlOntoSelection: true,
}
