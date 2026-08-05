import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 p-8 text-center">
        <h1 className="text-3xl font-bold">Revisa tu correo</h1>
        <p className="text-gray-600">
          Te enviamos un link de confirmación. Revisa tu correo para completar el registro.
        </p>
        <Link
          href="/login"
          className="inline-block text-blue-600 hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  )
}
