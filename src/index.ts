import { Context, Dict, Schema } from 'koishi'
import { inspect } from 'util'
import { mailConnection, imapConfig } from './mail'

export const name = 'example'  // mail-back

export interface Config {
  user: Dict<string>
  password: Dict<string>
  host: Dict<string>
  port: number
  tls: boolean
  tlsOptions?: {
    rejectUnauthorized: boolean
  }
}

export const Config: Schema<Config> = Schema.object({
  user: Schema.dict(Schema.string()).default({
    'google': '',
    'qq': ''
  }),
  password: Schema.dict(Schema.string()).default({
    'google': '',
    'qq': ''
  }),
  host: Schema.dict(Schema.string()).default({
    'google': 'imap.gmail.com',
    'qq': 'imap.qq.com'
  }),
  port: Schema.number().default(993),
  tls: Schema.boolean().default(true),
  tlsOptions: Schema.object({
    rejectUnauthorized: Schema.boolean().default(false),
  }),
})

const MailConnection: Dict<mailConnection> = {};
// 'ALL' - All messages.
// 'ANSWERED' - Messages with the Answered flag set.
// 'DELETED' - Messages with the Deleted flag set.
// 'DRAFT' - Messages with the Draft flag set.
// 'FLAGGED' - Messages with the Flagged flag set.
// 'NEW' - Messages that have the Recent flag set but not the Seen flag.
// 'SEEN' - Messages that have the Seen flag set.
// 'RECENT' - Messages that have the Recent flag set.
// 'OLD' - Messages that do not have the Recent flag set. This is functionally equivalent to "!RECENT" (as opposed to "!NEW").
// 'UNANSWERED' - Messages that do not have the Answered flag set.
// 'UNDELETED' - Messages that do not have the Deleted flag set.
// 'UNDRAFT' - Messages that do not have the Draft flag set.
// 'UNFLAGGED' - Messages that do not have the Flagged flag set.
// 'UNSEEN' - Messages that do not have the Seen flag set.

export function apply(ctx: Context, config: Config) {
  ctx.command('add <platform:string> <user:string> <password:string>')
      .usage('Add an email account')
      .option('host', '-H [host]')
      .option('port', '-p [port]')
      .option('tls', '-t [tls]')
      .option('rejectUnauthorized', '-r [RejectUnauthorized]')
      .action(({options}, platform, user, password) => {
        platform = platform.toLowerCase()
        config.user[platform] = user
        config.password[platform] = password
        
        // will change to a more general way to set the host, port, tls, tlsOptions later
        config.host[platform] = options.host ? options.host : (
          config.host[platform] ? config.host[platform] : undefined
        )
        config.port = options.port ? options.port : (
          config.port ? config.port : 993
        )
        config.tls = options.tls ? options.tls : (
          config.tls ? config.tls : true
        )
        config.tlsOptions.rejectUnauthorized = options.rejectUnauthorized ? options.rejectUnauthorized : (
          config.tlsOptions.rejectUnauthorized ? config.tlsOptions.rejectUnauthorized : false
        )

        return 'Email account added successfully'
    })
  
  ctx.command('delete <platform:string>')
      .action((_, platform) => {
        platform = platform.toLowerCase()
        if (!config.user[platform]) {
          return 'The platform does not exist'
        }
        delete config.user[platform]
        delete config.password[platform]
        delete config.host[platform]

        return 'Email account deleted successfully'
      })

  ctx.command('show')
      .action(() => {
        return inspect(config)
      })
  
  ctx.command('fetch <platform:string>')
    .option('mark', '-m [mark]')
    .option('type', '-t [type]')
    .option('number', '-n [number]')
    .option('since', '-s [since]')
    .action(({session, options}, platform) => {
      session.send('Connecting to IMAP server...');
      platform = platform.toLowerCase()
      let imapconfig: imapConfig = {
        user: config.user[platform],
        password: config.password[platform],
        host: config.host[platform],
        port: config.port,
        tls: config.tls,
        tlsOptions: config.tlsOptions,
        markSeen: options.mark ? true : false,
        type: options.type ? options.type : 'UNSEEN',
        fetchNumber: options.number ? options.number : 3,
        since: options.since ? new Date(options.since) : undefined
      }
      let mailInstance = new mailConnection(imapconfig) 
      mailInstance.fetch(session)
  })

  ctx.command('notify <platform:string>')
    .option('interval', '-i [interval]')
    .action(async ({session, options}, platform) => {
      platform = platform.toLowerCase()
      session.send('Register a new email notification on platform ' + platform);
      let imapconfig: imapConfig = {
        user: config.user[platform],
        password: config.password[platform],
        host: config.host[platform],
        port: config.port,
        tls: config.tls,
        tlsOptions: config.tlsOptions,
        markSeen: true,
        type: 'ALL',
        since: new Date(),
        timeInterval: options.interval ? options.interval : 1
      }
      let mailInstance = null

      if (MailConnection[platform]) {

        mailInstance = MailConnection[platform]
        mailInstance.adapt(imapconfig.timeInterval, imapconfig.since)
      }
      else {
        mailInstance = new mailConnection(imapconfig) 
        MailConnection[platform] = mailInstance
      }

      mailInstance.notify(session)
    })
}