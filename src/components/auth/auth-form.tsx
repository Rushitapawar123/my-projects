'client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCallStore } from '@/store/call-store'
import { toast } from '@/hooks/use-toast'

export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false)
  const setUser = useCallStore(s => s.setUser)
  const setAuthenticated = useCallStore(s => s.setAuthenticated)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword.trim()) return
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({ title: 'Login Failed', description: data.error || 'Invalid credentials', variant: 'destructive' })
      } else {
        setUser(data.id, data.name, data.email)
        setAuthenticated(true)
        toast({ title: 'Welcome back!', description: `Logged in as ${data.name}` })
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) return
    setIsLoading(true)

    try {
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail, password: signupPassword, name: signupName }),
      })

      const signupData = await signupRes.json()

      if (!signupRes.ok) {
        toast({ title: 'Signup Failed', description: signupData.error, variant: 'destructive' })
      } else {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: signupEmail, password: signupPassword }),
        })

        const loginData = await loginRes.json()

        if (loginRes.ok) {
          setUser(loginData.id, loginData.name, loginData.email)
          setAuthenticated(true)
          toast({ title: 'Account Created!', description: 'Welcome to SyncSpace!' })
        } else {
          toast({ title: 'Account Created', description: 'Please sign in with your credentials' })
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      {/* Brand Header */}
      <div className="text-center mb-8 space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 shadow-lg shadow-emerald-500/20 ring-1 ring-white/20 transition-transform duration-300 hover:scale-105">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
            SyncSpace
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5 font-medium">
            Next-gen real-time video conferencing & collaboration
          </p>
        </div>
      </div>

      {/* Auth Tabs Container */}
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/60 backdrop-blur-md rounded-xl mb-6 border border-border/50">
          <TabsTrigger value="login" className="rounded-lg font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">
            Sign In
          </TabsTrigger>
          <TabsTrigger value="signup" className="rounded-lg font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">
            Sign Up
          </TabsTrigger>
        </TabsList>

        {/* Login Tab */}
        <TabsContent value="login">
          <Card className="border-border/60 shadow-xl shadow-black/[0.03] backdrop-blur-xl bg-card/90">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl font-bold tracking-tight">Welcome Back</CardTitle>
              <CardDescription className="text-xs">Enter your details to access your collaboration rooms</CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="h-11 rounded-lg bg-background/50 border-input focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="h-11 rounded-lg bg-background/50 border-input focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="pt-2 pb-6">
                <Button 
                  type="submit" 
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : 'Sign In'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* Signup Tab */}
        <TabsContent value="signup">
          <Card className="border-border/60 shadow-xl shadow-black/[0.03] backdrop-blur-xl bg-card/90">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl font-bold tracking-tight">Create Account</CardTitle>
              <CardDescription className="text-xs">Get started with SyncSpace for seamless meetings</CardDescription>
            </CardHeader>
            <form onSubmit={handleSignup}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signupName}
                    onChange={e => setSignupName(e.target.value)}
                    className="h-11 rounded-lg bg-background/50 border-input focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    className="h-11 rounded-lg bg-background/50 border-input focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    className="h-11 rounded-lg bg-background/50 border-input focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    required
                    minLength={6}
                  />
                </div>
              </CardContent>
              <CardFooter className="pt-2 pb-6">
                <Button 
                  type="submit" 
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating account...
                    </span>
                  ) : 'Create Account'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Feature Badges Footer */}
      <div className="mt-8 pt-6 border-t border-border/40 text-center">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-muted-foreground/80">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            E2E Encrypted
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Secure WebRTC
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Ultra Low Latency
          </span>
        </div>
      </div>
    </div>
  )
}