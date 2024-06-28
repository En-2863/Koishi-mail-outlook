import * as cheerio from 'cheerio';
import { Decode } from './decode';
import * as qb from 'quoted-printable';
import { simpleParser } from 'mailparser';

export function detectEncoding(input: string): string {
    if (input.includes('MIME') || Decode.MIMEMatchRegx.test(input)) {
        return 'MIME';
    }

    if (Decode.base64Regex.test(input) || input.includes('Encoding: base64')) {
        return 'base64';
    }

    if (Decode.quotedPrintableRegex.test(input) || input.includes('Encoding: quoted-printable')) {
        return 'quoted-printable';
    }

    return 'utf-8';
  }
  
export function decodeString(input: string, encoding: string): string {
    let input_array = null
    let res = ''
    switch (encoding) {
    case 'base64':
        input = input.replace(/\n/g, '')
        return Buffer.from(input, 'base64').toString('utf-8')
    case 'MIME':
        let filterRegex = Decode.MIMEFilterRegex

        let matches = ('\n'+input).match(Decode.MIMERegex)
        if (matches) {
            let boundary = matches[2]
            input_array = input.split(boundary)
            for (let content of input_array) {
                if (!content.includes('Content-Type:') || !content.includes('Content-Transfer-Encoding:')) 
                    continue
                
                let encodeTypeMatches = content.match(Decode.MIMEEncodeTYpeRegex)
                let encodeType = encodeTypeMatches[1]
                content = content.replace(filterRegex[0], '')
                content = content.replace(filterRegex[1], '')
                res += decodeString(content, encodeType)
            }
            return res
        }
        return qb.decode(input)
    case 'quoted-printable':
        input = input.replace(/=\n/g, '')
        input = input.replace(/\n/g, '')
        input = input.replace(Decode.quotedPrintableReplaceRegex, (match, p1) => {
            return String.fromCharCode(parseInt(p1, 16));
          });
        return Buffer.from(input, 'binary').toString('utf-8');
    case 'utf-8':
        return Buffer.from(input).toString('utf-8');
    default:
        return input;
  }
}


export class DomTree {
    type: string
    children: DomTree[]
    parent: DomTree
    attributes: {[key: string]: string}
    content: string

    constructor(html: string | cheerio.Element){
        // html is string only when it is the root element
        if (typeof html === 'string') {
            this.parent = null
            const $ = cheerio.load(html)

            let parsedMessage = null;
            simpleParser(html, (err, mail) => {
                if (err) {
                    throw err;
                }
                parsedMessage = mail;
            });

            while (!parsedMessage) {
                require('deasync').runLoopOnce();
            }
            //this.parseEmailContent($('html')[0])
            //console.log('type:' +detectEncoding(this.content+'\n'))
            //this.content = decodeString(this.content, detectEncoding(this.content+'\n'))    
            //this.content = this.content.replace(Decode.ContentReplaceRegex, "")
            this.content = parsedMessage.text
        }
        else {
            this.parseEmailContent(html)
        }
    }

    parseEmailContent(root: cheerio.Element) {
        const elements = root.children
        this.children = []
        this.type = root.tagName
        this.attributes = root.attribs
        this.content = ''

        for (let element of elements) {
            if (element.type === 'text') {
                if (element.data !== undefined && element.data.trim() !== '') {
                    this.content += element.data.trim()
                }

            } else if (element.type === 'tag') {
                const children = new DomTree(element)
                children.parent = this
                this.content += children.content
                this.children.push(children)
            }
        }
    }

    loadContent() {
        return this.content
    }

    getAttribute(key: string) {
        return this.attributes[key]
    }

    getAttributes() {
        return this.attributes
    }

    getChildren() {
        return this.children
    }

    getParent() {
        return this.parent
    }
}