export namespace Decode {
    export const MIMEMatchRegx = /^(.*\n)*(--.*)\n(.*\n)*/
    export const MIMERegex = /\n(--.*)\n/g
    export const MIMEEncodeTYpeRegex = /Content-Transfer-Encoding:\s*([A-Za-z0-9\-]+)/
    export const MIMEFilterRegex = [/Content-Type:.*\n/, /Content-Transfer-Encoding:.*\n/]
    export const base64Regex = /^((?:[A-Za-z0-9+\/]{4})*\n)*$/
    export const quotedPrintableRegex = /=[A-Fa-f0-9]{2}/g
    export const quotedPrintableReplaceRegex = /=([A-Fa-f0-9]{2})/g
    export const ContentReplaceRegex = /^\s*[\r\n]/gm

    export const entities = {
        nbsp: ' ',
        quot: '"',
        lt: '<',
        gt: '>',
        cent: '¢',
        pound: '£',
        yen: '¥',
        euro: '€',
        copy: '©',
        reg: '®',
        amp: '&',
        apos: '\'',
    }
}