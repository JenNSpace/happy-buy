import Image from 'next/image'
import Link from 'next/link'
import { LoginForm } from '@/features/auth/components'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <Image src="/logo.png" alt="Happy Buy" width={72} height={72} className="mx-auto mb-4" priority />
          <h1 className="text-3xl font-bold text-gray-900">Happy Buy</h1>
          <p className="mt-2 text-gray-600">Inicia sesión en tu cuenta</p>
        </div>

        <LoginForm />

        <p className="text-center text-sm text-gray-600">
          ¿No tienes cuenta?{' '}
          <Link href="/signup" className="text-happy-green hover:underline">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  )
}
