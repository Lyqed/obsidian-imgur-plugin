import { Notice, Plugin } from 'obsidian'

import UrlIntoSelection from './core'
import { uploadToImgur } from './services/imgur'
import { DEFAULT_SETTINGS, ImgurPluginSettings } from './setting'
import RemoteUploadConfirmationDialog from './ui/RemoteUploadConfirmationDialog'
import { ImgurSettingTab } from './ui/SettingTab'

export default class ImgurPlugin extends Plugin {
  settings: ImgurPluginSettings
  private uploadConfirmationInProgress = false

  async onload() {
    await this.loadSettings()

    // Add settings tab
    this.addSettingTab(new ImgurSettingTab(this.app, this))

    // Register the paste event handler
    this.registerEvent(
      this.app.workspace.on('editor-paste', async (evt: ClipboardEvent, editor) => {
        console.log('Paste event:', {
          hasItems: !!evt.clipboardData?.items,
          text: evt.clipboardData?.getData('text'),
          types: evt.clipboardData?.types,
        })

        // Check if it's an image paste
        const items = evt.clipboardData?.items
        if (!items) return

        // First try to handle as URL paste if there's text
        const clipboardText = evt.clipboardData?.getData('text')
        if (clipboardText) {
          console.log('Attempting URL paste with:', clipboardText)
          if (UrlIntoSelection(editor, evt, this.settings)) {
            console.log('URL paste handled successfully')
            return
          }
        }

        // Then check for images
        for (const item of Array.from(items)) {
          console.log('Checking item:', item.type)
          if (item.type.startsWith('image/')) {
            console.log('Image detected, handling upload')
            evt.preventDefault()

            // If already showing confirmation dialog, skip
            if (this.uploadConfirmationInProgress) return
            this.uploadConfirmationInProgress = true

            try {
              const dialog = new RemoteUploadConfirmationDialog(this.app)
              dialog.open()
              const response = await dialog.response()
              console.log('Upload dialog response:', response)

              // Ensure response exists and has expected shape
              if (!response || typeof response !== 'object' || !('shouldUpload' in response)) {
                console.log('Invalid dialog response')
                return
              }

              // Now TypeScript knows response has shouldUpload property
              if (response.shouldUpload === undefined) {
                console.log('Dialog closed without choice')
                return
              }

              if (response.shouldUpload === true) {
                console.log('User chose to upload')
                // Handle image upload to imgur
                const blob: File | null = item.getAsFile()
                if (!blob) {
                  new Notice('Failed to get image data')
                  return
                }

                try {
                  const imgurUrl = await uploadToImgur(blob, this.settings.clientId)
                  // Use the imgur URL with the existing URL paste logic
                  UrlIntoSelection(editor, imgurUrl, this.settings)
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                  console.error('Failed to upload to imgur:', errorMessage)
                  new Notice(`Failed to upload image to Imgur: ${errorMessage}`)
                }
              } else {
                // Handle as normal URL paste
                UrlIntoSelection(editor, evt, this.settings)
              }

              if ('alwaysUpload' in response && response.alwaysUpload === true) {
                this.settings.showRemoteUploadConfirmation = false
                await this.saveSettings()
              }
            } finally {
              this.uploadConfirmationInProgress = false
            }
            return
          }
        }

        // If not an image, handle as normal URL paste
        UrlIntoSelection(editor, evt, this.settings)
      }),
    )
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}
