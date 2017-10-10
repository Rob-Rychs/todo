const {createRobot} = require('probot')
const payloads = require('./fixtures/payloads')
const app = require('..')
const fs = require('fs')
const path = require('path')

function gimmeRobot (config = 'basic.yml', issues = [{ data: [{ title: 'An issue that exists', state: 'open', body: `\n\n<!-- probot = {"10000":{"title": "An issue that exists","file": "index.js"}} -->` }] }]) {
  const cfg = config ? fs.readFileSync(path.join(__dirname, 'fixtures', 'configs', config), 'utf8') : config
  let robot
  let github
  const content = (str) => Promise.resolve({ data: { content: Buffer.from(str) } })

  robot = createRobot()
  app(robot)

  github = {
    issues: {
      getForRepo: jest.fn().mockReturnValue(Promise.resolve(issues)),
      create: jest.fn(),
      createLabel: jest.fn(),
      edit: jest.fn(),
      createComment: jest.fn()
    },
    paginate: jest.fn().mockReturnValue(Promise.resolve(issues)),
    repos: {
      // Response for getting content from '.github/todo.yml'
      getContent: jest.fn((obj) => {
        if (obj.path.includes('config.yml')) {
          if (config === false) {
            throw { code: 404 } // eslint-disable-line
          }
          return content(cfg)
        } else {
          return content(fs.readFileSync(path.join(__dirname, 'fixtures', 'files', obj.path), 'utf8'))
        }
      })
    },
    pullRequests: {
      getAll: jest.fn().mockReturnValue(Promise.resolve({ data: [{ head: { ref: 'master' }, number: 10 }] }))
    }
  }
  // Passes the mocked out GitHub API into out robot instance
  robot.auth = () => Promise.resolve(github)
  return { robot, github }
}

describe('todo', () => {
  it('requests issues for the repo', async () => {
    const {robot, github} = gimmeRobot()
    await robot.receive(payloads.basic)
    expect(github.issues.getForRepo.mock.calls.length).toBe(1)
  })

  it('creates an issue', async () => {
    const {robot, github} = gimmeRobot()
    await robot.receive(payloads.basic)
    expect(github.issues.create.mock.calls.length).toBe(1)
    expect(github.issues.create).toBeCalledWith({
      body: fs.readFileSync(path.join(__dirname, 'fixtures', 'bodies', 'pr.txt'), 'utf8'),
      number: undefined,
      labels: ['todo'],
      owner: 'JasonEtco',
      repo: 'test',
      title: 'Jason!',
      assignee: 'JasonEtco'
    })
  })

  it('creates an issue without assigning anyone', async () => {
    const {robot, github} = gimmeRobot('autoAssignFalse.yml')
    await robot.receive(payloads.basic)
    expect(github.issues.create).toBeCalledWith({
      body: fs.readFileSync(path.join(__dirname, 'fixtures', 'bodies', 'autoAssignFalse.txt'), 'utf8'),
      number: undefined,
      labels: ['todo'],
      owner: 'JasonEtco',
      repo: 'test',
      title: 'Jason!'
    })
  })

  it('creates an issue and assigns the configured user', async () => {
    const {robot, github} = gimmeRobot('autoAssignString.yml')
    await robot.receive(payloads.basic)
    expect(github.issues.create).toBeCalledWith({
      body: fs.readFileSync(path.join(__dirname, 'fixtures', 'bodies', 'autoAssignString.txt'), 'utf8'),
      number: undefined,
      labels: ['todo'],
      owner: 'JasonEtco',
      repo: 'test',
      title: 'Jason!',
      assignee: 'matchai'
    })
  })

  it('creates an issue and assigns the configured users', async () => {
    const {robot, github} = gimmeRobot('autoAssignArr.yml')
    await robot.receive(payloads.basic)
    expect(github.issues.create).toBeCalledWith({
      body: fs.readFileSync(path.join(__dirname, 'fixtures', 'bodies', 'autoAssignArr.txt'), 'utf8'),
      number: undefined,
      labels: ['todo'],
      owner: 'JasonEtco',
      repo: 'test',
      title: 'Jason!',
      assignees: ['JasonEtco', 'matchai', 'defunkt']
    })
  })

  it('creates an issue adds an array of labels', async () => {
    const {robot, github} = gimmeRobot('labelArr.yml')
    await robot.receive(payloads.basic)
    expect(github.issues.create).toBeCalledWith({
      body: fs.readFileSync(path.join(__dirname, 'fixtures', 'bodies', 'pr.txt'), 'utf8'),
      number: undefined,
      labels: ['one', 'two'],
      owner: 'JasonEtco',
      repo: 'test',
      title: 'Jason!',
      assignee: 'JasonEtco'
    })
  })

  it('works with a complex push (with multiple commits)', async () => {
    const {robot, github} = gimmeRobot()
    await robot.receive(payloads.complex)
    expect(github.issues.create.mock.calls.length).toBe(3)
  })

  it('respects the capitalization config', async () => {
    const {robot, github} = gimmeRobot('caseSensitive.yml')
    await robot.receive(payloads.complex)
    expect(github.issues.create.mock.calls.length).toBe(1)
  })

  it('does not create any issues', async () => {
    const {robot, github} = gimmeRobot('caseSensitivePizza.yml')
    await robot.receive(payloads.complex)
    expect(github.issues.create.mock.calls.length).toBe(0)
  })

  it('does not create an issue that already exists', async () => {
    const {robot, github} = gimmeRobot('existing.yml')
    await robot.receive(payloads.complex)
    expect(github.issues.create.mock.calls.length).toBe(0)
  })

  it('works without a config present', async () => {
    const {robot, github} = gimmeRobot(false)
    await robot.receive(payloads.basic)
    expect(github.issues.create.mock.calls.length).toBe(1)
  })

  it('creates 31 issues', async () => {
    const {robot, github} = gimmeRobot()
    await robot.receive(payloads.many)
    expect(github.issues.create.mock.calls.length).toBe(33)
  })

  it('paginates when there are over 30 issues', async () => {
    const issuesPageOne = Array.apply(null, Array(30)).map((v, i) => ({ title: `I do not exist ${i}`, state: 'open', body: `\n\n<!-- probot = {"10000":{"title": "I do not exist ${i}"}} -->` }))
    const issuesPageTwo = Array.apply(null, Array(3)).map((v, i) => ({ title: `I do not exist ${i + 30}`, state: 'open', body: `\n\n<!-- probot = {"10000":{"title": "I do not exist ${i + 30}"}} -->` }))
    const {robot, github} = gimmeRobot('basic.yml', [{ data: issuesPageOne }, { data: issuesPageTwo }])
    await robot.receive(payloads.many)
    expect(github.issues.create.mock.calls.length).toBe(33)
  })

  it('paginates when there are over 30 issues and does not make them', async () => {
    const issuesPageOne = Array.apply(null, Array(30)).map((v, i) => ({ title: `I exist ${i}`, state: 'open', body: `\n\n<!-- probot = {"10000":{"title": "I exist ${i}","file": "many.js"}} -->` }))
    const issuesPageTwo = Array.apply(null, Array(2)).map((v, i) => ({ title: `I exist ${i + 30}`, state: 'open', body: `\n\n<!-- probot = {"10000":{"title": "I exist ${i + 30}","file": "many.js"}} -->` }))
    const {robot, github} = gimmeRobot('basic.yml', [{ data: issuesPageOne }, { data: issuesPageTwo }])
    await robot.receive(payloads.many)
    expect(github.issues.create.mock.calls.length).toBe(1)
  })

  it('works with issues with empty bodies', async () => {
    const {robot, github} = gimmeRobot('basic.yml', [{ data: [{ title: 'Hey', state: 'open' }] }])
    await robot.receive(payloads.basic)
    expect(github.issues.create.mock.calls.length).toBe(1)
  })

  it('parses titles and respects case-insensitive', async () => {
    const {robot, github} = gimmeRobot()
    await robot.receive(payloads.caseinsensitive)
    const expectedBody = fs.readFileSync(path.join(__dirname, 'fixtures', 'bodies', 'caseinsensitive.txt'), 'utf8')
    expect(github.issues.create).toHaveBeenCalledWith({
      title: 'My keyword is case insensitive!',
      body: expectedBody,
      owner: 'JasonEtco',
      assignee: 'JasonEtco',
      repo: 'test',
      labels: ['todo'],
      number: undefined
    })
  })

  it('does not throw errors when head_commit is null', async () => {
    const {robot, github} = gimmeRobot()
    await robot.receive(payloads.merge)
    expect(github.issues.create.mock.calls.length).toBe(0)
  })

  it('reopens a closed issue', async () => {
    const issues = [{data: [{
      title: 'An issue that exists',
      state: 'open',
      body: `\n\n<!-- probot = {"10000":{"title": "An issue that exists","file": "index.js"}} -->`
    }, {
      title: 'Jason!',
      state: 'closed',
      body: `\n\n<!-- probot = {"10000":{"title": "Jason!","file": "index.js"}} -->`
    }]}]
    const {robot, github} = gimmeRobot('basic.yml', issues)
    await robot.receive(payloads.basic)
    expect(github.issues.edit).toHaveBeenCalledTimes(1)
    expect(github.issues.createComment).toHaveBeenCalledTimes(1)
    expect(github.issues.create).toHaveBeenCalledTimes(0)
  })

  it('respects the reopenClosed config', async () => {
    const issues = [{data: [{
      title: 'An issue that exists',
      state: 'open',
      body: `\n\n<!-- probot = {"10000":{"title": "An issue that exists","file": "index.js"}} -->`
    }, {
      title: 'Jason!',
      state: 'closed',
      body: `\n\n<!-- probot = {"10000":{"title": "Jason!","file": "index.js"}} -->`
    }]}]
    const {robot, github} = gimmeRobot('reopenClosedFalse.yml', issues)
    await robot.receive(payloads.basic)
    expect(github.issues.edit).toHaveBeenCalledTimes(0)
    expect(github.issues.createComment).toHaveBeenCalledTimes(0)
    expect(github.issues.create).toHaveBeenCalledTimes(0)
  })

  it('allows the user to specify labels', async () => {
    const {robot, github} = gimmeRobot()
    await robot.receive(payloads.labels)
    const expectedBody = fs.readFileSync(path.join(__dirname, 'fixtures', 'bodies', 'labels.txt'), 'utf8')
    expect(github.issues.create).toHaveBeenCalledWith({
      title: 'This title has labels',
      body: expectedBody,
      owner: 'JasonEtco',
      assignee: 'JasonEtco',
      repo: 'test',
      labels: ['example', 'label'],
      number: undefined
    })
  })

  describe('installation', () => {
    let robotLog
    const {robot} = gimmeRobot()

    beforeEach(() => {
      robotLog = robot.log
      robot.log = jest.fn()
    })

    afterEach(() => {
      robot.log = robotLog
    })

    it('logs the proper message to the console', async () => {
      await robot.receive(payloads.installCreatedOne)
      expect(robot.log).toHaveBeenCalledWith('todo was just installed on JasonEtco/test.')
    })

    it('logs the proper message to the console w/ 2 repos', async () => {
      await robot.receive(payloads.installCreatedTwo)
      expect(robot.log).toHaveBeenCalledWith('todo was just installed on JasonEtco/test and JasonEtco/pizza.')
    })

    it('logs the proper message to the console w/ 3 repos', async () => {
      await robot.receive(payloads.installCreatedThree)
      expect(robot.log).toHaveBeenCalledWith('todo was just installed on JasonEtco/test, JasonEtco/pizza and JasonEtco/example.')
    })
  })
})
