const generateBody = require('../../lib/generate-body')
const payloads = require('../fixtures/payloads')
const fs = require('fs')
const path = require('path')

describe('generate-body', () => {
  let context

  const title = 'example'
  const file = 'index.js'
  const contents = '\n\n@todo example\nasdfas\nasdfdsafasd\nsd\nasdfsa\n\nsdfsadfsa'
  const contentsBody = '\n\n@todo example\n@body This one has a body\nasdfas\nasdfdsafasd\nsd\nasdfsa\n\nsdfsadfsa'
  const author = payloads.basic.payload.head_commit.author.username
  const sha = payloads.basic.payload.head_commit.id

  beforeEach(() => {
    context = {
      repo: () => ({
        owner: payloads.basic.payload.repository.owner.login,
        repo: payloads.basic.payload.repository.name
      })
    }
  })

  it('generates a body string', () => {
    const config = { keyword: '@todo', blobLines: 2 }
    const body = generateBody(context, config, title, file, contents, author, sha)

    expect(typeof body).toBe('string')
    expect(body).toBe(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'bodies', 'defaults.txt'), 'utf8'))
  })

  it('generates a body string with a PR', () => {
    const config = { keyword: '@todo', blobLines: 2 }

    const body = generateBody(context, config, title, file, contents, author, sha, 10)

    expect(typeof body).toBe('string')
    expect(body).toBe(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'bodies', 'pr.txt'), 'utf8'))
  })

  it('generates a body string without a blob, blobLines: false', () => {
    const config = { keyword: '@todo', blobLines: false }

    const body = generateBody(context, config, title, file, contents, author, sha)

    expect(typeof body).toBe('string')
    expect(body).toBe(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'bodies', 'no-blob.txt'), 'utf8'))
  })

  it('generates a body string without a blob, blobLines: 0', () => {
    const config = { keyword: '@todo', blobLines: 0 }

    const body = generateBody(context, config, title, file, contents, author, sha)

    expect(typeof body).toBe('string')
    expect(body).toBe(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'bodies', 'no-blob.txt'), 'utf8'))
  })

  it('generates a body string with a custom message', () => {
    const config = { keyword: '@todo', blobLines: 2 }

    const body = generateBody(context, config, title, file, contentsBody, author, sha)

    expect(typeof body).toBe('string')
    expect(body).toBe(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'bodies', 'with-body.txt'), 'utf8'))
  })
})
