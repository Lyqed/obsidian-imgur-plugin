import { App, Notice, PluginSettingTab, Setting } from 'obsidian'
import { IMGUR_ACCESS_TOKEN_LOCALSTORAGE_KEY, IMGUR_PLUGIN_CLIENT_ID } from 'src/imgur/constants'
import ImgurPlugin from '../ImgurPlugin'
import UploadStrategy from '../UploadStrategy'
import ImgurAuthModal from './ImgurAuthModal'
import ImgurAuthenticationStatusItem from './ImgurAuthenticationStatus'
import ApiError from 'src/uploader/ApiError'

const REGISTER_CLIENT_URL = 'https://api.imgur.com/oauth2/addclient'

export default class ImgurPluginSettingsTab extends PluginSettingTab {
  plugin: ImgurPlugin

  authModal?: ImgurAuthModal

  strategyDiv?: HTMLDivElement

  authElem?: ImgurAuthenticationStatusItem

  constructor(app: App, plugin: ImgurPlugin) {
    super(app, plugin)
    this.plugin = plugin

    this.plugin.registerObsidianProtocolHandler('imgur-oauth', (params) => {
      if (!this.authModal || !this.authModal.isOpen) return

      if (params.error) {
        new Notice(`Authentication failed with error: ${params.error}`)
        return
      }

      const mappedData = params.hash.split('&').map((p) => {
        const sp = p.split('=')
        return [sp[0], sp[1]] as [string, string]
      })
      const map = new Map<string, string>(mappedData)
      localStorage.setItem(IMGUR_ACCESS_TOKEN_LOCALSTORAGE_KEY, map.get('access_token'))

      this.plugin.setupImagesUploader()

      this.authModal.close()
      this.authModal = null
    })
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    containerEl.createEl('h2', { text: 'Imgur Plugin settings' })

    const uploadApproachDiv = containerEl.createDiv()
    this.strategyDiv = containerEl.createDiv()

    new Setting(uploadApproachDiv).setName('Images upload approach').addDropdown((dropdown) => {
      UploadStrategy.values.forEach((s) => {
        dropdown.addOption(s.id, s.description)
      })
      dropdown.setValue(this.plugin.settings.uploadStrategy)
      dropdown.onChange(async (v) => {
        this.plugin.settings.uploadStrategy = v
        this.plugin.setupImagesUploader()
        await this.drawSettings(this.strategyDiv)
      })
    })

    void this.drawSettings(this.strategyDiv)

    new Setting(containerEl).setName('Confirm before upload').addToggle((t) => {
      t.setValue(this.plugin.settings.showRemoteUploadConfirmation)
      t.onChange((newValue) => {
        this.plugin.settings.showRemoteUploadConfirmation = newValue
      })
    })
  }

  async hide(): Promise<void> {
    await this.plugin.saveSettings()
    this.plugin.setupImagesUploader()
  }

  private async drawSettings(parentEl: HTMLElement) {
    parentEl.empty()
    switch (this.plugin.settings.uploadStrategy) {
      case UploadStrategy.ANONYMOUS_IMGUR.id:
        this.drawAnonymousClientIdSetting(parentEl)
        break
      case UploadStrategy.AUTHENTICATED_IMGUR.id:
        await this.createAuthenticationInfoBlock(parentEl)
        break
      default:
        throw new Error('There must be a bug, this code is not expected to be reached')
    }
  }

  private drawAnonymousClientIdSetting(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName('Client ID')
      .setTooltip(
        `Client ID is required for anonymous images upload. If you do not provide your own Client ID, the one shipped with the plugin and shared with many other users will be used. If you face issues with images upload, it's better generate your own Client ID"`,
      )
      .setDesc(ImgurPluginSettingsTab.clientIdSettingDescription())
      .addText((text) =>
        text
          .setPlaceholder('Enter your client_id')
          .setValue(this.plugin.settings.clientId)
          .onChange((value) => {
            this.plugin.settings.clientId = value
          }),
      )
  }

  private static clientIdSettingDescription() {
    const fragment = document.createDocumentFragment()
    const a = document.createElement('a')
    a.textContent = REGISTER_CLIENT_URL
    a.setAttribute('href', REGISTER_CLIENT_URL)
    fragment.append('Generate your own Client ID at ')
    fragment.append(a)
    return fragment
  }

  private async createAuthenticationInfoBlock(parentEl: HTMLElement) {
    this.authElem = new ImgurAuthenticationStatusItem(parentEl)
    await this.drawAuthenticationInfo()
    this.authElem.authButtonClick = () => {
      const modal = new ImgurAuthModal(IMGUR_PLUGIN_CLIENT_ID, this.app, async () => {
        await this.drawAuthenticationInfo()
      })
      modal.open()
      this.authModal = modal
    }
    this.authElem.logoutButtonClick = async () => {
      localStorage.removeItem(IMGUR_ACCESS_TOKEN_LOCALSTORAGE_KEY)

      this.plugin.setupImagesUploader()
      await this.drawAuthenticationInfo()
    }
  }

  private async drawAuthenticationInfo() {
    const authenticatedClient = this.plugin.getAuthenticatedImgurClient()
    if (!authenticatedClient) {
      this.authElem.setNotAuthenticated()
      return
    }

    this.authElem.setStatusChecking()
    try {
      const authenticatedUserName = (await authenticatedClient.accountInfo()).data.url
      this.authElem.setAuthenticatedAs(authenticatedUserName)
    } catch (e) {
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        this.authElem.setInternetConnectionProblem()
      } else if (e instanceof ApiError) {
        this.authElem.setImgurSessionError(e.message)
      } else {
        console.warn('Not authenticated, exception: ', e)
        this.authElem.setNotAuthenticatedWithError()
      }
    }
  }
}
