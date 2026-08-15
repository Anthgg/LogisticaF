import { expect, test } from '@playwright/test'

test.describe('Post-Fase 045 · PDF protegido', () => {
  test('una sesión anónima recibe 401 sin popup ni descarga basura', async ({
    page,
  }) => {
    const popups: string[] = []
    const downloads: string[] = []
    page.on('popup', (popup) => popups.push(popup.url()))
    page.on('download', (download) => downloads.push(download.suggestedFilename()))

    await page.goto('/')

    const result = await page.evaluate(async () => {
      const response = await fetch(
        '/api/logistics/documents/00000000-0000-0000-0000-000000000001/preview',
        {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/pdf' },
        },
      )
      return {
        url: response.url,
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentDisposition: response.headers.get('content-disposition'),
        body: await response.text(),
      }
    })

    expect(result.status).toBe(401)
    expect(result.contentType).toContain('application/json')
    expect(result.contentDisposition).toBeNull()
    expect(result.body).not.toContain('%PDF-')
    expect(result.url).not.toContain('/api/api/')
    expect(result.url).not.toMatch(/run\.app|cloudfunctions\.net/)
    expect(result.url).not.toMatch(/[?&]warehouse_id=(?:&|$)/)
    expect(popups).toEqual([])
    expect(downloads).toEqual([])
  })
})
