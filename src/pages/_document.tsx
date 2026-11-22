// The HTML shell around every page, rendered on the server only. It exists to set <html lang> to the
// reader's language (spec 0054, cross check 2), so screen readers and the browser read the page in
// Greek or English from the first byte.
import Document, { Head, Html, Main, NextScript, type DocumentContext, type DocumentInitialProps } from 'next/document'
import { languageFromCookies, type Language } from '../i18n/language'

// A class component: Next's Document must be one when it has its own getInitialProps.
export default class PortalDocument extends Document<{ language: Language }> {
  // `static` means it belongs to the class itself, not to one instance; Next calls it per request.
  static async getInitialProps(context: DocumentContext): Promise<DocumentInitialProps & { language: Language }> {
    const initialProps = await Document.getInitialProps(context)
    return { ...initialProps, language: languageFromCookies(context.req?.headers.cookie) }
  }

  render() {
    return (
      <Html lang={this.props.language}>
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
