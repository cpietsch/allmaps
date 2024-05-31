import { writable } from 'svelte/store'

function getUrlsFromQueryString(location: Location): Array<string> | null {
  const searchParams = new URLSearchParams(location.search)
  const urls = searchParams.getAll('url')
  return urls
}

function getUrlFromHash(location: Location): Array<string> | null {
  const hashQueryString = location.hash.slice(1)

  if (!hashQueryString) {
    return null
  }

  const searchParams = new URLSearchParams(hashQueryString)
  const data = searchParams.get('data')

  const dataUrlPrefix = 'data:text/x-url,'

  if (data) {
    if (data.startsWith(dataUrlPrefix)) {
      const url = data.slice(dataUrlPrefix.length)
      return [url]
    }
  }

  return null
}

export function fromUrl() {
  if (typeof window !== 'undefined') {
    const queryStringUrls = getUrlsFromQueryString(window.location)
    const hashUrl = getUrlFromHash(window.location)

    if (queryStringUrls !== null && queryStringUrls.length) {
      return queryStringUrls
    } else if (hashUrl !== null && hashUrl.length) {
      return hashUrl
    }
  }

  return []
}

export default writable<Array<string>>(fromUrl())
