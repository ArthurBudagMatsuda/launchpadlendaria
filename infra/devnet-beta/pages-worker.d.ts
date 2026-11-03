interface FetchBinding {
  fetch(request: Request): Promise<Response>;
}
declare const gateway: {
  fetch(
    request: Request,
    env: { ASSETS: FetchBinding; METADATA_SERVICE?: FetchBinding },
  ): Promise<Response>;
};
export default gateway;
