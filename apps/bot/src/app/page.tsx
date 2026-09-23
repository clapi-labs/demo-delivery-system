/**
 * El bot no tiene interfaz: es webhook y motor.
 *
 * Esta página existe para confirmar de un vistazo que el despliegue está vivo
 * y que el webhook está donde Meta espera encontrarlo.
 */
export default function Status() {
  return (
    <main className="mx-auto max-w-md p-8 font-mono text-sm">
      <p className="font-semibold">Bot — WhatsApp Cloud API</p>
      <p className="mt-2 text-neutral-600">
        Sin interfaz. El webhook vive en{" "}
        <code className="rounded bg-neutral-100 px-1">
          /api/webhook/whatsapp
        </code>
        .
      </p>
    </main>
  );
}
