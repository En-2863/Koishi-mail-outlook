import { Session } from 'koishi'
import Connection from 'imap'
import { inspect } from 'util'
import { ConnectionOptions } from 'tls';
import { DomTree } from './utils';

export interface imapConfig {
    user: string,
    password: string,
    host: string,
    port: number,
    tls: boolean,
    tlsOptions?: ConnectionOptions,
    markSeen?: boolean,
    type?: string,
    fetchNumber?: number,
    since?: Date,
    timeInterval?: number
}

// async function parseEmail(rawEmail: string) {
//     const parsedEmail = await simpleParser(rawEmail);
//     var reply = ''
//     reply += parsedEmail.subject + '\n'
//     reply += parsedEmail.from?.value + '\n'
//     reply += parsedEmail.to?.value + '\n'
//     reply += parsedEmail.text + '\n'
//     reply += parsedEmail.html + '\n'
// 
//     return reply
// }

export class mailConnection {
    imap: Connection
    markSeen: boolean
    readType: string
    fetchNumber: number
    since: Date | undefined
    session: Session
    timeInterval: number
    intervalId: NodeJS.Timeout | null

    constructor(config: imapConfig){
        this.imap = new Connection({
            user: config.user,
            password: config.password,
            host: config.host,
            port: config.port,
            tls: config.tls,
            tlsOptions: config.tlsOptions
        })
        this.timeInterval = config.timeInterval
        this.markSeen = config.markSeen
        this.readType = config.type
        this.fetchNumber = config.fetchNumber
        this.since = config.since ? config.since : undefined
    }

    adapt(interval: number, since: Date) {
        this.timeInterval = interval
        this.since = since
    }

    fetch(session: Session) {
        this.session = session
        this.imap.once('error', function(err) {
            session.send('Connection to IMAP server failed: ' + err);
        });
        this.imap.once('end', function() {
            session.send('Connection to IMAP server ended');
        });
        this.imap.once('ready', () => {
            this.imap.openBox('INBOX', true, (err, box) => {
                this.search(err, box)
            })
        });
        this.imap.connect();
    }

    search(err: Error, box: Connection.Box) {
        if (err) throw err;
        
        let criteria = [[this.readType? this.readType: 'UNSEEN']]
        if (this.since instanceof Date) 
            criteria.push(['SINCE', this.since.toDateString()])

        this.imap.search(criteria, (err, results) => {
            if (err) throw err;

            if (!results || results.length === 0) {
                this.session.send('No unseen emails');
                this.imap.end();
                return;
            }

            if (results.length < this.fetchNumber) {
                this.fetchNumber = -1
            }

            var f = this.imap.fetch(results.slice(0, this.fetchNumber), { 
                bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT']});

                f.on('message', (msg, seqno) => {
                    var prefix = '(#' + seqno + ') '
                    var reply = ''
                    msg.on('body', (stream, info) => {
                        var buffer = '', count = 0;

                        stream.on('data', (chunk) => {
                            count += chunk.length;
                            buffer += chunk.toString(); 
                        });

                        stream.once('end', () => {
                            if (info.which !== 'TEXT')
                                reply += prefix + 'Parsed header:' + inspect(Connection.parseHeader(buffer)) + '\n'
                            else {
                                const domTree = new DomTree(buffer)
                                this.session.send(prefix+'Content:' + domTree.loadContent() + '\n')
                            }
                        })
                    })

                    //msg.once('attributes', (attrs) => {
                    //    reply += prefix + 'Attributes: %s' + inspect(attrs, false, 8) + '\n'
                    //})

                    msg.once('end', () => {
                        if (this.markSeen) {
                            this.imap.seq.addFlags(seqno, 'Seen', function(err) {
                                if (err) {
                                  this.session.send(prefix+'Error marking message as seen', err);
                                }
                            });
                        }
                        this.session.send(reply)
                    })
                  });
          
                f.once('end', () => {
                    this.session.send('Done fetching all unseen emails!');
                    this.imap.end();
                });
        });
        
        
    }

    notify(session: Session) {
        if (this.intervalId !== null) {
            console.log('clear interval: ' + this.intervalId)
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log('interval: ' + this.timeInterval)
        console.log(this.timeInterval == -1)
        if (this.timeInterval == -1) {
            console.log('stop')
            session.send('Email notification stopped');
            return
        }

        this.session = session
        this.imap.once('error', function(err) {
            session.send('Connection to IMAP server failed: ' + err);
        });
        this.imap.once('end', function() {
            session.send('Connection to IMAP server ended');
        });
        const checkMail = () => {
            this.imap.once('ready', () => {
                this.imap.openBox('INBOX', true, (err, box) => {
                    this.search(err, box)
                })
            });
            this.imap.connect();
        };
        checkMail();

        this.intervalId = setInterval(checkMail, this.timeInterval * 60 * 1000);
        console.log('intervalId: ' + this.intervalId)

    }
}