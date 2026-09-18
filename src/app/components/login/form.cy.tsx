import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import { Route, Routes } from 'react-router-dom'
import { ROUTES } from '@/routes/routesList'
import { useAppStore } from '@/store/app.store'
import { queryKeys } from '@/utils/queryKeys'
import { LoginForm } from './form'

// Like the desktop updater, this query stays mounted across login and logout.
function PendingUpdateCheck() {
  useQuery({
    queryKey: [queryKeys.update.check],
    queryFn: () => new Promise<never>(() => {}),
    staleTime: Infinity,
  })
  return null
}

function Library() {
  const { data } = useQuery({
    queryKey: [queryKeys.album.all],
    queryFn: async () => 'Current library',
    staleTime: Infinity,
  })
  return <h1>{data}</h1>
}

describe('Login navigation', () => {
  let client: QueryClient

  beforeEach(() => {
    useAppStore.getState().actions.removeConfig()
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    cy.intercept('GET', 'https://music.example.test/rest/ping.view*', {
      'subsonic-response': { status: 'ok', version: '1.16.0', type: 'subsonic' },
    })
  })

  afterEach(() => {
    client.clear()
    useAppStore.getState().actions.removeConfig()
  })

  function mountLogin() {
    cy.mount(
      <QueryClientProvider client={client}>
        <PendingUpdateCheck />
        <Routes>
          <Route path={ROUTES.SERVER_CONFIG} element={<LoginForm />} />
          <Route path={ROUTES.LIBRARY.HOME} element={<Library />} />
        </Routes>
      </QueryClientProvider>,
      { routerProps: { initialEntries: [ROUTES.SERVER_CONFIG] } },
    )
    cy.get('#url').clear().type('https://music.example.test')
    cy.get('#username').type('test-user')
    cy.get('input[type="password"]').type('test-password')
    cy.get('button[type="submit"]').click()
  }

  it('enters the library while the desktop update check is still pending', () => {
    mountLogin()
    cy.contains('h1', 'Current library').should('be.visible')
    cy.then(() => {
      expect(useAppStore.getState().data.isServerConfigured).to.equal(true)
      expect(
        client.getQueryState([queryKeys.update.check])?.fetchStatus,
      ).to.equal('fetching')
    })
  })

  it('refreshes the previous session library on entering the library', () => {
    client.setQueryData([queryKeys.album.all], 'Previous library')
    mountLogin()
    cy.contains('h1', 'Current library').should('be.visible')
  })

  it('allows another attempt after rejected credentials', () => {
    cy.intercept('GET', 'https://music.example.test/rest/ping.view*', {
      'subsonic-response': {
        status: 'failed',
        version: '1.16.0',
        type: 'subsonic',
        error: { code: 40, message: 'Wrong username or password' },
      },
    })
    mountLogin()
    cy.get('button[type="submit"]').should('be.enabled')
    cy.get('h1').should('not.exist')
    cy.then(() => {
      expect(useAppStore.getState().data.isServerConfigured).to.equal(false)
    })
  })
})
