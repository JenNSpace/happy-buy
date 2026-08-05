import Image from 'next/image'
import Link from 'next/link'
import { SignupForm } from '@/features/auth/components'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <Image src="/logo.png" alt="Happy Buy" width={72} height={72} className="mx-auto mb-4" priority />
          <h1 className="text-3xl font-bold text-gray-900">Happy Buy</h1>
          <p className="mt-2 text-gray-600">Crea tu cuenta</p>
        </div>

        <SignupForm />

        <p className="text-center text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-happy-green hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
