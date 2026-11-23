/** Keep the base atlas visible. Reconsider a failed optional read at most twice. */
const RETRIES_MS=[1250,3500] as const;

export class DetailTemporaryError extends Error {}

export function detailHttpTemporary(status:number) {
  return status===408||status===425||status===429||(status>=500&&status<=599);
}

export function detailRetryAt(error:unknown, failures:number, now:number) {
  if(!(error instanceof DetailTemporaryError))return undefined;
  const delay=RETRIES_MS[failures-1];
  return delay===undefined ? undefined : now+delay;
}
