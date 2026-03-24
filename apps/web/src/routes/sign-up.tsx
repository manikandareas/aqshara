import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@clerk/tanstack-react-start'

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  )
}
