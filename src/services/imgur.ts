interface ImgurUploadResponse {
  data: {
    link: string
    deletehash?: string
  }
  success: boolean
  status: number
}

// Type guard to validate response shape
function isImgurUploadResponse(data: unknown): data is ImgurUploadResponse {
  if (!data || typeof data !== 'object') return false

  const response = data as Record<string, unknown>
  if (!('data' in response) || !('success' in response) || !('status' in response)) return false

  const { data: imgData, success, status } = response
  if (typeof success !== 'boolean' || typeof status !== 'number') return false

  if (!imgData || typeof imgData !== 'object') return false
  const imgDataObj = imgData as Record<string, unknown>

  if (!('link' in imgDataObj) || typeof imgDataObj.link !== 'string') return false

  if ('deletehash' in imgDataObj && typeof imgDataObj.deletehash !== 'string') return false

  return true
}

export async function uploadToImgur(file: File, clientId: string): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)

  try {
    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${clientId}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: unknown = await response.json()
    if (!isImgurUploadResponse(data)) {
      throw new Error('Invalid response from Imgur API')
    }

    if (!data.success) {
      throw new Error('Upload failed')
    }

    return data.data.link
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error uploading to imgur:', errorMessage)
    throw new Error(`Failed to upload to Imgur: ${errorMessage}`)
  }
}
