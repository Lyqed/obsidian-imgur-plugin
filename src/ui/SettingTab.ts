import { App, Plugin, PluginSettingTab, Setting } from 'obsidian'

import { ImgurPluginSettings, NothingSelected } from '../setting'

export class ImgurSettingTab extends PluginSettingTab {
  plugin: Plugin & { settings: ImgurPluginSettings; saveSettings: () => Promise<void> }

  constructor(
    app: App,
    plugin: Plugin & { settings: ImgurPluginSettings; saveSettings: () => Promise<void> },
  ) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl('h2', { text: 'Imgur Plugin Settings' })

    new Setting(containerEl)
      .setName('When nothing is selected')
      .setDesc('What to do when pasting a URL with no text selected')
      .addDropdown((dropdown) =>
        dropdown
          .addOption(NothingSelected.doNothing, 'Do nothing')
          .addOption(NothingSelected.autoSelect, 'Auto-select word under cursor')
          .addOption(NothingSelected.insertInline, 'Insert [](url)')
          .addOption(NothingSelected.insertBare, 'Insert <url>')
          .setValue(this.plugin.settings.nothingSelected)
          .onChange(async (value: NothingSelected) => {
            this.plugin.settings.nothingSelected = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Show upload confirmation')
      .setDesc('Show a confirmation dialog before uploading images to Imgur')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showRemoteUploadConfirmation)
          .onChange(async (value) => {
            this.plugin.settings.showRemoteUploadConfirmation = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('URL regex')
      .setDesc('Regular expression to validate URLs without protocol')
      .addText((text) =>
        text
          .setPlaceholder('^(?:https?://)?(?:www\\.)?[^\\s/$.?#].[^\\s]*$')
          .setValue(this.plugin.settings.regex)
          .onChange(async (value) => {
            this.plugin.settings.regex = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Image URL patterns')
      .setDesc('Regular expressions to identify image URLs (one per line)')
      .addTextArea((text) =>
        text
          .setPlaceholder('\\.(gif|jpe?g|tiff?|png|webp|bmp)$\nimgur\\.com')
          .setValue(this.plugin.settings.listForImgEmbed)
          .onChange(async (value) => {
            this.plugin.settings.listForImgEmbed = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Convert selection to hyperlink')
      .setDesc('When enabled, pasting an Imgur URL onto selected text will create a markdown link')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.convertSelectionToHyperlink)
          .onChange(async (value) => {
            this.plugin.settings.convertSelectionToHyperlink = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Paste URL onto selection')
      .setDesc(
        'When enabled, allows pasting URLs onto selected text. When disabled, selected text will be preserved.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.pasteUrlOntoSelection).onChange(async (value) => {
          this.plugin.settings.pasteUrlOntoSelection = value
          await this.plugin.saveSettings()
        }),
      )
  }
}
