import { Authority } from "../../src/authority/Authority";
import { INetworkModule, NetworkRequestOptions } from "../../src/network/INetworkModule";
import { Constants } from "../../src/utils/Constants";
import {
    TEST_URIS,
    RANDOM_TEST_GUID,
    DEFAULT_OPENID_CONFIG_RESPONSE,
    TEST_CONFIG,
    DEFAULT_TENANT_DISCOVERY_RESPONSE,
    B2C_OPENID_CONFIG_RESPONSE
} from "../utils/StringConstants";
import { ClientConfigurationErrorMessage, ClientConfigurationError } from "../../src/error/ClientConfigurationError";
import { AuthorityMetadataEntity, AuthorityOptions, ClientAuthError, ClientAuthErrorMessage, ProtocolMode } from "../../src";
import { MockStorageClass, mockCrypto } from "../client/ClientTestUtils";

let mockStorage: MockStorageClass;

const authorityOptions: AuthorityOptions = {
    protocolMode: ProtocolMode.AAD,
    knownAuthorities: [Constants.DEFAULT_AUTHORITY_HOST],
    cloudDiscoveryMetadata: "",
    authorityMetadata: ""
}

describe("Authority.ts Class Unit Tests", () => {
    beforeEach(() => {
        mockStorage = new MockStorageClass(TEST_CONFIG.MSAL_CLIENT_ID, mockCrypto);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("Constructor", () => {

        it("Creates canonical authority uri based on given uri (and normalizes with '/')", () => {
            const networkInterface: INetworkModule = {
                sendGetRequestAsync<T>(url: string, options?: NetworkRequestOptions): T {
                    // @ts-ignore
                    return null;
                },
                sendPostRequestAsync<T>(url: string, options?: NetworkRequestOptions): T {
                    // @ts-ignore
                    return null;
                }
            };
            const authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
            expect(authority.canonicalAuthority).toBe(`${Constants.DEFAULT_AUTHORITY}`);
        });

        it("Throws error if URI is not in valid format", () => {
            const networkInterface: INetworkModule = {
                sendGetRequestAsync<T>(url: string, options?: NetworkRequestOptions): T {
                    // @ts-ignore
                    return null;
                },
                sendPostRequestAsync<T>(url: string, options?: NetworkRequestOptions): T {
                    // @ts-ignore
                    return null;
                }
            };

            expect(() => new Authority("http://login.microsoftonline.com/common", networkInterface, mockStorage, authorityOptions)).toThrowError(ClientConfigurationErrorMessage.authorityUriInsecure.desc);
            expect(() => new Authority("This is not a URI", networkInterface, mockStorage, authorityOptions)).toThrowError(ClientConfigurationErrorMessage.urlParseError.desc);
            expect(() => new Authority("", networkInterface, mockStorage, authorityOptions)).toThrowError(ClientConfigurationErrorMessage.urlEmptyError.desc);
        });
    });

    describe("Getters and setters", () => {
        const networkInterface: INetworkModule = {
            sendGetRequestAsync<T>(url: string, options?: NetworkRequestOptions): T {
                // @ts-ignore
                return null;
            },
            sendPostRequestAsync<T>(url: string, options?: NetworkRequestOptions): T {
                // @ts-ignore
                return null;
            }
        };
        let authority: Authority;
        beforeEach(() => {
            authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
        });

        it("Gets canonical authority that ends in '/'", () => {
            expect(authority.canonicalAuthority.endsWith("/")).toBe(true);
            expect(authority.canonicalAuthority).toBe(`${Constants.DEFAULT_AUTHORITY}`);
        });

        it("Set canonical authority performs validation and canonicalization on url", () => {
            expect(() => authority.canonicalAuthority = "http://login.microsoftonline.com/common").toThrowError(ClientConfigurationErrorMessage.authorityUriInsecure.desc);
            expect(() => authority.canonicalAuthority = "https://login.microsoftonline.com/").not.toThrowError();
            expect(() => authority.canonicalAuthority = "This is not a URI").toThrowError(ClientConfigurationErrorMessage.urlParseError.desc);

            authority.canonicalAuthority = `${TEST_URIS.ALTERNATE_INSTANCE}/${RANDOM_TEST_GUID}`;
            expect(authority.canonicalAuthority.endsWith("/")).toBe(true);
            expect(authority.canonicalAuthority).toBe(`${TEST_URIS.ALTERNATE_INSTANCE}/${RANDOM_TEST_GUID}/`);
        });

        it("Get canonicalAuthorityUrlComponents returns current url components", () => {
            expect(authority.canonicalAuthorityUrlComponents.Protocol).toBe("https:");
            expect(authority.canonicalAuthorityUrlComponents.HostNameAndPort).toBe("login.microsoftonline.com");
            expect(authority.canonicalAuthorityUrlComponents.PathSegments).toEqual(["common"]);
            expect(authority.canonicalAuthorityUrlComponents.AbsolutePath).toBe("/common/");
            expect(authority.canonicalAuthorityUrlComponents.Hash).toBeUndefined();
            expect(authority.canonicalAuthorityUrlComponents.Search).toBeUndefined();
        });

        it("tenant is equal to first path segment value", () => {
            expect(authority.tenant).toBe("common");
            expect(authority.tenant).toBe(authority.canonicalAuthorityUrlComponents.PathSegments[0]);
        });

        it("Gets options that were passed into constructor", () => {
            expect(authority.options).toBe(authorityOptions);
        });

        describe("OAuth Endpoints", () => {

            beforeEach(async () => {
                jest.spyOn(Authority.prototype, <any>"getEndpointMetadataFromNetwork").mockResolvedValue(DEFAULT_OPENID_CONFIG_RESPONSE.body);
                await authority.resolveEndpointsAsync();
            });

            it("Returns authorization_endpoint of tenantDiscoveryResponse", () => {
                expect(authority.authorizationEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.authorization_endpoint.replace("{tenant}", "common")
                );
            });

            it("Returns token_endpoint of tenantDiscoveryResponse", () => {
                expect(authority.tokenEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.token_endpoint.replace("{tenant}", "common")
                );
            });

            it("Returns end_session_endpoint of tenantDiscoveryResponse", () => {
                expect(authority.endSessionEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.end_session_endpoint.replace("{tenant}", "common")
                );
            });

            it("Returns issuer of tenantDiscoveryResponse for selfSignedJwtAudience", () => {
                expect(authority.selfSignedJwtAudience).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.issuer.replace("{tenant}", "common"));
            });

            it("Throws error if endpoint discovery is incomplete for authorizationEndpoint, tokenEndpoint, endSessionEndpoint and selfSignedJwtAudience", () => {
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
                expect(() => authority.authorizationEndpoint).toThrowError(ClientAuthErrorMessage.endpointResolutionError.desc);
                expect(() => authority.tokenEndpoint).toThrowError(ClientAuthErrorMessage.endpointResolutionError.desc);
                expect(() => authority.endSessionEndpoint).toThrowError(ClientAuthErrorMessage.endpointResolutionError.desc);
                expect(() => authority.deviceCodeEndpoint).toThrowError(ClientAuthErrorMessage.endpointResolutionError.desc);
                expect(() => authority.selfSignedJwtAudience).toThrowError(ClientAuthErrorMessage.endpointResolutionError.desc);
            });

            it("Returns endpoints for different b2c policy than what is cached", async () => {
                jest.clearAllMocks();
                const signInPolicy = "b2c_1_sisopolicy";
                const resetPolicy = "b2c_1_password_reset";
                const baseAuthority = "https://login.microsoftonline.com/tfp/msidlabb2c.onmicrosoft.com/";
                jest.spyOn(Authority.prototype, <any>"getEndpointMetadataFromNetwork").mockResolvedValue(B2C_OPENID_CONFIG_RESPONSE.body);

                authority = new Authority(`${baseAuthority}${signInPolicy}`, networkInterface, mockStorage, authorityOptions);
                await authority.resolveEndpointsAsync();
                const secondAuthority = new Authority(`${baseAuthority}${resetPolicy}`, networkInterface, mockStorage, authorityOptions);
                await secondAuthority.resolveEndpointsAsync();

                expect(authority.authorizationEndpoint).toBe(B2C_OPENID_CONFIG_RESPONSE.body.authorization_endpoint);
                expect(secondAuthority.authorizationEndpoint).toBe(
                    B2C_OPENID_CONFIG_RESPONSE.body.authorization_endpoint.replace(signInPolicy, resetPolicy)
                );
                expect(authority.tokenEndpoint).toBe(B2C_OPENID_CONFIG_RESPONSE.body.token_endpoint);
                expect(secondAuthority.tokenEndpoint).toBe(
                    B2C_OPENID_CONFIG_RESPONSE.body.token_endpoint.replace(signInPolicy, resetPolicy)
                );
                expect(authority.endSessionEndpoint).toBe(B2C_OPENID_CONFIG_RESPONSE.body.end_session_endpoint);
                expect(secondAuthority.endSessionEndpoint).toBe(
                    B2C_OPENID_CONFIG_RESPONSE.body.end_session_endpoint.replace(signInPolicy, resetPolicy)
                );
            });
        });
    });

    describe("Endpoint discovery", () => {

        const networkInterface: INetworkModule = {
            sendGetRequestAsync<T>(url: string, options?: NetworkRequestOptions): T {
                // @ts-ignore
                return null;
            },
            sendPostRequestAsync<T>(url: string, options?: NetworkRequestOptions): T {
                // @ts-ignore
                return null;
            }
        };
        let authority: Authority;
        beforeEach(() => {
            authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
        });

        it("discoveryComplete returns false if endpoint discovery has not been completed", () => {
            expect(authority.discoveryComplete()).toBe(false);
        });

        it("discoveryComplete returns true if resolveEndpointsAsync resolves successfully", async () => {
            jest.spyOn(Authority.prototype, <any>"getEndpointMetadataFromNetwork").mockResolvedValue(DEFAULT_OPENID_CONFIG_RESPONSE.body);
            await authority.resolveEndpointsAsync();
            expect(authority.discoveryComplete()).toBe(true);
        });

        
        describe("Endpoint Metadata", () => {
            it("Gets endpoints from config", async () => {
                const options = {
                    protocolMode: ProtocolMode.AAD,
                    knownAuthorities: [Constants.DEFAULT_AUTHORITY_HOST],
                    cloudDiscoveryMetadata: "",
                    authorityMetadata: JSON.stringify(DEFAULT_OPENID_CONFIG_RESPONSE.body)
                };
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, options);
                await authority.resolveEndpointsAsync();
    
                expect(authority.discoveryComplete()).toBe(true);
                expect(authority.authorizationEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.authorization_endpoint.replace("{tenant}", "common")
                );
                expect(authority.tokenEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.token_endpoint.replace("{tenant}", "common")
                );
                expect(authority.deviceCodeEndpoint).toBe(authority.tokenEndpoint.replace("/token", "/devicecode"));
                expect(authority.endSessionEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.end_session_endpoint.replace("{tenant}", "common")
                );
                expect(authority.selfSignedJwtAudience).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.issuer.replace("{tenant}", "common"));

                // Test that the metadata is cached
                const key = `authority-metadata-${TEST_CONFIG.MSAL_CLIENT_ID}-${Constants.DEFAULT_AUTHORITY_HOST}`;
                const cachedAuthorityMetadata = mockStorage.getAuthorityMetadata(key);
                if (!cachedAuthorityMetadata) {
                    throw Error("Cached AuthorityMetadata should not be null!");
                } else {
                    expect(cachedAuthorityMetadata.authorization_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.authorization_endpoint);
                    expect(cachedAuthorityMetadata.token_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.token_endpoint);
                    expect(cachedAuthorityMetadata.end_session_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.end_session_endpoint);
                    expect(cachedAuthorityMetadata.issuer).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.issuer);
                    expect(cachedAuthorityMetadata.endpointsFromNetwork).toBe(false);
                }
            });

            it("Throws error if authorityMetadata cannot be parsed to json", (done) => {
                const options = {
                    protocolMode: ProtocolMode.AAD,
                    knownAuthorities: [Constants.DEFAULT_AUTHORITY_HOST],
                    cloudDiscoveryMetadata: "",
                    authorityMetadata: "invalid-json"
                };
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, options);
                authority.resolveEndpointsAsync().catch(e => {
                    expect(e).toBeInstanceOf(ClientConfigurationError);
                    expect(e.errorMessage).toBe(ClientConfigurationErrorMessage.invalidAuthorityMetadata.desc);
                    done();
                });
            });

            it("Gets endpoints from cache", async () => {
                const key = `authority-metadata-${TEST_CONFIG.MSAL_CLIENT_ID}-${Constants.DEFAULT_AUTHORITY_HOST}`;
                const value = new AuthorityMetadataEntity();
                value.updateCloudDiscoveryMetadata(DEFAULT_TENANT_DISCOVERY_RESPONSE.body.metadata[0], true);
                value.updateEndpointMetadata(DEFAULT_OPENID_CONFIG_RESPONSE.body, true);
                value.updateCanonicalAuthority(Constants.DEFAULT_AUTHORITY);
                mockStorage.setAuthorityMetadata(key, value);

                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
                await authority.resolveEndpointsAsync();
    
                expect(authority.discoveryComplete()).toBe(true);
                expect(authority.authorizationEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.authorization_endpoint.replace("{tenant}", "common")
                );
                expect(authority.tokenEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.token_endpoint.replace("{tenant}", "common")
                );
                expect(authority.deviceCodeEndpoint).toBe(authority.tokenEndpoint.replace("/token", "/devicecode"));
                expect(authority.endSessionEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.end_session_endpoint.replace("{tenant}", "common")
                );
                expect(authority.selfSignedJwtAudience).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.issuer.replace("{tenant}", "common"));

                // Test that the metadata is cached
                const cachedAuthorityMetadata = mockStorage.getAuthorityMetadata(key);
                if (!cachedAuthorityMetadata) {
                    throw Error("Cached AuthorityMetadata should not be null!");
                } else {
                    expect(cachedAuthorityMetadata.authorization_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.authorization_endpoint);
                    expect(cachedAuthorityMetadata.token_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.token_endpoint);
                    expect(cachedAuthorityMetadata.end_session_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.end_session_endpoint);
                    expect(cachedAuthorityMetadata.issuer).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.issuer);
                    expect(cachedAuthorityMetadata.endpointsFromNetwork).toBe(true);
                }
            });

            it("Gets endpoints from network if cached metadata is expired", async () => {
                const key = `authority-metadata-${TEST_CONFIG.MSAL_CLIENT_ID}-${Constants.DEFAULT_AUTHORITY_HOST}`;
                const value = new AuthorityMetadataEntity();
                value.updateCloudDiscoveryMetadata(DEFAULT_TENANT_DISCOVERY_RESPONSE.body.metadata[0], true);
                value.updateEndpointMetadata(DEFAULT_OPENID_CONFIG_RESPONSE.body, true);
                value.updateCanonicalAuthority(Constants.DEFAULT_AUTHORITY);
                mockStorage.setAuthorityMetadata(key, value);

                jest.spyOn(AuthorityMetadataEntity.prototype, "isExpired").mockReturnValue(true);

                networkInterface.sendGetRequestAsync = (url: string, options?: NetworkRequestOptions): any => {
                    return DEFAULT_OPENID_CONFIG_RESPONSE;
                };
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
                await authority.resolveEndpointsAsync();
    
                expect(authority.discoveryComplete()).toBe(true);
                expect(authority.authorizationEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.authorization_endpoint.replace("{tenant}", "common")
                );
                expect(authority.tokenEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.token_endpoint.replace("{tenant}", "common")
                );
                expect(authority.deviceCodeEndpoint).toBe(authority.tokenEndpoint.replace("/token", "/devicecode"));
                expect(authority.endSessionEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.end_session_endpoint.replace("{tenant}", "common")
                );
                expect(authority.selfSignedJwtAudience).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.issuer.replace("{tenant}", "common"));

                // Test that the metadata is cached
                const cachedAuthorityMetadata = mockStorage.getAuthorityMetadata(key);
                if (!cachedAuthorityMetadata) {
                    throw Error("Cached AuthorityMetadata should not be null!");
                } else {
                    expect(cachedAuthorityMetadata.authorization_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.authorization_endpoint);
                    expect(cachedAuthorityMetadata.token_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.token_endpoint);
                    expect(cachedAuthorityMetadata.end_session_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.end_session_endpoint);
                    expect(cachedAuthorityMetadata.issuer).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.issuer);
                    expect(cachedAuthorityMetadata.endpointsFromNetwork).toBe(true);
                }
            });

            it("Gets endpoints from network", async () => {
                networkInterface.sendGetRequestAsync = (url: string, options?: NetworkRequestOptions): any => {
                    return DEFAULT_OPENID_CONFIG_RESPONSE;
                };
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
                await authority.resolveEndpointsAsync();
    
                expect(authority.discoveryComplete()).toBe(true);
                expect(authority.authorizationEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.authorization_endpoint.replace("{tenant}", "common")
                );
                expect(authority.tokenEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.token_endpoint.replace("{tenant}", "common")
                );
                expect(authority.deviceCodeEndpoint).toBe(authority.tokenEndpoint.replace("/token", "/devicecode"));
                expect(authority.endSessionEndpoint).toBe(
                    DEFAULT_OPENID_CONFIG_RESPONSE.body.end_session_endpoint.replace("{tenant}", "common")
                );
                expect(authority.selfSignedJwtAudience).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.issuer.replace("{tenant}", "common"));

                // Test that the metadata is cached
                const key = `authority-metadata-${TEST_CONFIG.MSAL_CLIENT_ID}-${Constants.DEFAULT_AUTHORITY_HOST}`;
                const cachedAuthorityMetadata = mockStorage.getAuthorityMetadata(key);
                if (!cachedAuthorityMetadata) {
                    throw Error("Cached AuthorityMetadata should not be null!");
                } else {
                    expect(cachedAuthorityMetadata.authorization_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.authorization_endpoint);
                    expect(cachedAuthorityMetadata.token_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.token_endpoint);
                    expect(cachedAuthorityMetadata.end_session_endpoint).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.end_session_endpoint);
                    expect(cachedAuthorityMetadata.issuer).toBe(DEFAULT_OPENID_CONFIG_RESPONSE.body.issuer);
                    expect(cachedAuthorityMetadata.endpointsFromNetwork).toBe(true);
                }
            });

            it("Throws error if openid-configuration network call fails", (done) => {
                networkInterface.sendGetRequestAsync = (url: string, options?: NetworkRequestOptions): any => {
                    throw Error("Unable to reach endpoint");
                };
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
                authority.resolveEndpointsAsync().catch(e => {
                    expect(e).toBeInstanceOf(ClientAuthError);
                    expect(e.errorMessage.includes(ClientAuthErrorMessage.unableToGetOpenidConfigError.desc)).toBe(true);
                    done();
                });
            });
        });

        describe("Cloud Discovery Metadata", () => {
            it("Sets instance metadata from knownAuthorities config", async () => {
                const authorityOptions: AuthorityOptions = {
                    protocolMode: ProtocolMode.AAD,
                    knownAuthorities: [Constants.DEFAULT_AUTHORITY_HOST],
                    cloudDiscoveryMetadata: "",
                    authorityMetadata: ""
                };
                networkInterface.sendGetRequestAsync = (url: string, options?: NetworkRequestOptions): any => {
                    return DEFAULT_OPENID_CONFIG_RESPONSE;
                };
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
                await authority.resolveEndpointsAsync();
                expect(authority.isAlias(Constants.DEFAULT_AUTHORITY_HOST)).toBe(true);
                expect(authority.getPreferredCache()).toBe(Constants.DEFAULT_AUTHORITY_HOST);
                expect(authority.canonicalAuthority.includes(Constants.DEFAULT_AUTHORITY_HOST)).toBe(true);

                // Test that the metadata is cached
                const key = `authority-metadata-${TEST_CONFIG.MSAL_CLIENT_ID}-${Constants.DEFAULT_AUTHORITY_HOST}`;
                const cachedAuthorityMetadata = mockStorage.getAuthorityMetadata(key);
                if (!cachedAuthorityMetadata) {
                    throw Error("Cached AuthorityMetadata should not be null!");
                } else {
                    expect(cachedAuthorityMetadata.aliases).toContain(Constants.DEFAULT_AUTHORITY_HOST);
                    expect(cachedAuthorityMetadata.preferred_cache).toBe(Constants.DEFAULT_AUTHORITY_HOST);
                    expect(cachedAuthorityMetadata.preferred_network).toBe(Constants.DEFAULT_AUTHORITY_HOST);
                    expect(cachedAuthorityMetadata.aliasesFromNetwork).toBe(false);
                }
            });

            it("Sets instance metadata from cloudDiscoveryMetadata config & change canonicalAuthority to preferred_network", async () => {
                const authorityOptions: AuthorityOptions = {
                    protocolMode: ProtocolMode.AAD,
                    knownAuthorities: [],
                    cloudDiscoveryMetadata: JSON.stringify(DEFAULT_TENANT_DISCOVERY_RESPONSE.body),
                    authorityMetadata: ""
                };
                networkInterface.sendGetRequestAsync = (url: string, options?: NetworkRequestOptions): any => {
                    return DEFAULT_OPENID_CONFIG_RESPONSE;
                };

                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
                await authority.resolveEndpointsAsync();
                expect(authority.isAlias("login.microsoftonline.com")).toBe(true);
                expect(authority.isAlias("login.windows.net")).toBe(true);
                expect(authority.isAlias("sts.windows.net")).toBe(true);
                expect(authority.getPreferredCache()).toBe("sts.windows.net");
                expect(authority.canonicalAuthority.includes("login.windows.net")).toBe(true);

                // Test that the metadata is cached
                const key = `authority-metadata-${TEST_CONFIG.MSAL_CLIENT_ID}-sts.windows.net`;
                const cachedAuthorityMetadata = mockStorage.getAuthorityMetadata(key);
                if (!cachedAuthorityMetadata) {
                    throw Error("Cached AuthorityMetadata should not be null!");
                } else {
                    expect(cachedAuthorityMetadata.aliases).toContain("login.microsoftonline.com");
                    expect(cachedAuthorityMetadata.aliases).toContain("login.windows.net");
                    expect(cachedAuthorityMetadata.aliases).toContain("sts.windows.net");
                    expect(cachedAuthorityMetadata.preferred_cache).toBe("sts.windows.net");
                    expect(cachedAuthorityMetadata.preferred_network).toBe("login.windows.net");
                    expect(cachedAuthorityMetadata.aliasesFromNetwork).toBe(false);
                }
            });

            it("Sets instance metadata from cache", async () => {
                const authorityOptions: AuthorityOptions = {
                    protocolMode: ProtocolMode.AAD,
                    knownAuthorities: [],
                    cloudDiscoveryMetadata: "",
                    authorityMetadata: ""
                };

                const key = `authority-metadata-${TEST_CONFIG.MSAL_CLIENT_ID}-sts.windows.net`;
                const value = new AuthorityMetadataEntity();
                value.updateCloudDiscoveryMetadata(DEFAULT_TENANT_DISCOVERY_RESPONSE.body.metadata[0], true);
                value.updateCanonicalAuthority(Constants.DEFAULT_AUTHORITY);
                mockStorage.setAuthorityMetadata(key, value);
                jest.spyOn(Authority.prototype, <any>"updateEndpointMetadata").mockResolvedValue("cache");
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
    
                await authority.resolveEndpointsAsync();
                expect(authority.isAlias("login.microsoftonline.com")).toBe(true);
                expect(authority.isAlias("login.windows.net")).toBe(true);
                expect(authority.isAlias("sts.windows.net")).toBe(true);
                expect(authority.getPreferredCache()).toBe("sts.windows.net");
                expect(authority.canonicalAuthority.includes("login.windows.net")).toBe(true);

                // Test that the metadata is cached
                const cachedAuthorityMetadata = mockStorage.getAuthorityMetadata(key);
                if (!cachedAuthorityMetadata) {
                    throw Error("Cached AuthorityMetadata should not be null!");
                } else {
                    expect(cachedAuthorityMetadata.aliases).toContain("login.microsoftonline.com");
                    expect(cachedAuthorityMetadata.aliases).toContain("login.windows.net");
                    expect(cachedAuthorityMetadata.aliases).toContain("sts.windows.net");
                    expect(cachedAuthorityMetadata.preferred_cache).toBe("sts.windows.net");
                    expect(cachedAuthorityMetadata.preferred_network).toBe("login.windows.net");
                    expect(cachedAuthorityMetadata.aliasesFromNetwork).toBe(true);
                }
            });

            it("Sets instance metadata from network if cached metadata is expired", async () => {
                const authorityOptions: AuthorityOptions = {
                    protocolMode: ProtocolMode.AAD,
                    knownAuthorities: [],
                    cloudDiscoveryMetadata: "",
                    authorityMetadata: ""
                }

                const key = `authority-metadata-${TEST_CONFIG.MSAL_CLIENT_ID}-sts.windows.net`;
                const value = new AuthorityMetadataEntity();
                value.updateCloudDiscoveryMetadata(DEFAULT_TENANT_DISCOVERY_RESPONSE.body.metadata[0], true);
                value.updateCanonicalAuthority(Constants.DEFAULT_AUTHORITY);
                mockStorage.setAuthorityMetadata(key, value);
                jest.spyOn(AuthorityMetadataEntity.prototype, "isExpired").mockReturnValue(true);
                jest.spyOn(Authority.prototype, <any>"updateEndpointMetadata").mockResolvedValue("cache");

                networkInterface.sendGetRequestAsync = (url: string, options?: NetworkRequestOptions): any => {
                    return DEFAULT_TENANT_DISCOVERY_RESPONSE;
                };
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
    
                await authority.resolveEndpointsAsync();
                expect(authority.isAlias("login.microsoftonline.com")).toBe(true);
                expect(authority.isAlias("login.windows.net")).toBe(true);
                expect(authority.isAlias("sts.windows.net")).toBe(true);
                expect(authority.getPreferredCache()).toBe("sts.windows.net");
                expect(authority.canonicalAuthority.includes("login.windows.net")).toBe(true);

                // Test that the metadata is cached
                const cachedAuthorityMetadata = mockStorage.getAuthorityMetadata(key);
                if (!cachedAuthorityMetadata) {
                    throw Error("Cached AuthorityMetadata should not be null!");
                } else {
                    expect(cachedAuthorityMetadata.aliases).toContain("login.microsoftonline.com");
                    expect(cachedAuthorityMetadata.aliases).toContain("login.windows.net");
                    expect(cachedAuthorityMetadata.aliases).toContain("sts.windows.net");
                    expect(cachedAuthorityMetadata.preferred_cache).toBe("sts.windows.net");
                    expect(cachedAuthorityMetadata.preferred_network).toBe("login.windows.net");
                    expect(cachedAuthorityMetadata.aliasesFromNetwork).toBe(true);
                }
            });

            it("Sets instance metadata from network", async () => {
                const authorityOptions: AuthorityOptions = {
                    protocolMode: ProtocolMode.AAD,
                    knownAuthorities: [],
                    cloudDiscoveryMetadata: "",
                    authorityMetadata: ""
                }
                networkInterface.sendGetRequestAsync = (url: string, options?: NetworkRequestOptions): any => {
                    return DEFAULT_TENANT_DISCOVERY_RESPONSE;
                };
                jest.spyOn(Authority.prototype, <any>"updateEndpointMetadata").mockResolvedValue("cache");
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
    
                await authority.resolveEndpointsAsync();
                expect(authority.isAlias("login.microsoftonline.com")).toBe(true);
                expect(authority.isAlias("login.windows.net")).toBe(true);
                expect(authority.isAlias("sts.windows.net")).toBe(true);
                expect(authority.getPreferredCache()).toBe("sts.windows.net");
                expect(authority.canonicalAuthority.includes("login.windows.net")).toBe(true);

                // Test that the metadata is cached
                const key = `authority-metadata-${TEST_CONFIG.MSAL_CLIENT_ID}-sts.windows.net`;
                const cachedAuthorityMetadata = mockStorage.getAuthorityMetadata(key);
                if (!cachedAuthorityMetadata) {
                    throw Error("Cached AuthorityMetadata should not be null!");
                } else {
                    expect(cachedAuthorityMetadata.aliases).toContain("login.microsoftonline.com");
                    expect(cachedAuthorityMetadata.aliases).toContain("login.windows.net");
                    expect(cachedAuthorityMetadata.aliases).toContain("sts.windows.net");
                    expect(cachedAuthorityMetadata.preferred_cache).toBe("sts.windows.net");
                    expect(cachedAuthorityMetadata.preferred_network).toBe("login.windows.net");
                    expect(cachedAuthorityMetadata.aliasesFromNetwork).toBe(true);
                }
            });

            it("Sets metadata from host if network call succeeds but does not explicitly include the host", async () => {
                const authorityOptions: AuthorityOptions = {
                    protocolMode: ProtocolMode.AAD,
                    knownAuthorities: [],
                    cloudDiscoveryMetadata: "",
                    authorityMetadata: ""
                }
                networkInterface.sendGetRequestAsync = (url: string, options?: NetworkRequestOptions): any => {
                    return DEFAULT_TENANT_DISCOVERY_RESPONSE;
                };
                jest.spyOn(Authority.prototype, <any>"updateEndpointMetadata").mockResolvedValue("cache");
                authority = new Authority("https://custom-domain.microsoft.com", networkInterface, mockStorage, authorityOptions);
    
                await authority.resolveEndpointsAsync();
                expect(authority.isAlias("custom-domain.microsoft.com")).toBe(true);
                expect(authority.getPreferredCache()).toBe("custom-domain.microsoft.com");
                expect(authority.canonicalAuthority.includes("custom-domain.microsoft.com"));

                // Test that the metadata is cached
                const key = `authority-metadata-${TEST_CONFIG.MSAL_CLIENT_ID}-custom-domain.microsoft.com`;
                const cachedAuthorityMetadata = mockStorage.getAuthorityMetadata(key);
                if (!cachedAuthorityMetadata) {
                    throw Error("Cached AuthorityMetadata should not be null!");
                } else {
                    expect(cachedAuthorityMetadata.aliases).toContain("custom-domain.microsoft.com");
                    expect(cachedAuthorityMetadata.preferred_cache).toBe("custom-domain.microsoft.com");
                    expect(cachedAuthorityMetadata.preferred_network).toBe("custom-domain.microsoft.com");
                    expect(cachedAuthorityMetadata.aliasesFromNetwork).toBe(true);
                }
            });

            it("Throws if cloudDiscoveryMetadata cannot be parsed into json", (done) => {
                const authorityOptions: AuthorityOptions = {
                    protocolMode: ProtocolMode.AAD,
                    knownAuthorities: [],
                    cloudDiscoveryMetadata: "this-is-not-valid-json",
                    authorityMetadata: ""
                }
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
                authority.resolveEndpointsAsync().catch(e => {
                    expect(e).toBeInstanceOf(ClientConfigurationError);
                    expect(e.errorMessage).toBe(ClientConfigurationErrorMessage.invalidCloudDiscoveryMetadata.desc);
                    done();
                });
            });

            it("throws untrustedAuthority error if host is not part of knownAuthorities, cloudDiscoveryMetadata and instance discovery network call fails", (done) => {
                const authorityOptions: AuthorityOptions = {
                    protocolMode: ProtocolMode.AAD,
                    knownAuthorities: [],
                    cloudDiscoveryMetadata: "",
                    authorityMetadata: ""
                };
                networkInterface.sendGetRequestAsync = (url: string, options?: NetworkRequestOptions): any => {
                    throw Error("Unable to get response");
                };
                authority = new Authority(Constants.DEFAULT_AUTHORITY, networkInterface, mockStorage, authorityOptions);
    
                authority.resolveEndpointsAsync().catch(e => {
                    expect(e).toBeInstanceOf(ClientConfigurationError);
                    expect(e.errorMessage).toBe(ClientConfigurationErrorMessage.untrustedAuthority.desc);
                    expect(e.errorCode).toBe(ClientConfigurationErrorMessage.untrustedAuthority.code);
                    done();
                });
            });

            it("getPreferredCache throws error if discovery is not complete", () => {
                expect(() => authority.getPreferredCache()).toThrowError(ClientAuthErrorMessage.endpointResolutionError.desc);
            });
        });

        it("ADFS authority uses v1 well-known endpoint", async () => {
            const authorityUrl = "https://login.microsoftonline.com/adfs/"
            let endpoint = "";
            authority = new Authority(authorityUrl, networkInterface, mockStorage, authorityOptions);
            jest.spyOn(networkInterface, <any>"sendGetRequestAsync").mockImplementation((openIdConfigEndpoint) => {
                // @ts-ignore
                endpoint = openIdConfigEndpoint;
                return DEFAULT_OPENID_CONFIG_RESPONSE;
            });

            await authority.resolveEndpointsAsync();
            expect(endpoint).toBe(`${authorityUrl}.well-known/openid-configuration`);
        });

        it("OIDC ProtocolMode does not append v2 to endpoint", async () => {
            const authorityUrl = "https://login.microsoftonline.com/"
            let endpoint = "";
            const options = {
                protocolMode: ProtocolMode.OIDC,
                knownAuthorities: [Constants.DEFAULT_AUTHORITY],
                cloudDiscoveryMetadata: "",
                authorityMetadata: ""
            }
            authority = new Authority(authorityUrl, networkInterface, mockStorage, options);
            jest.spyOn(networkInterface, <any>"sendGetRequestAsync").mockImplementation((openIdConfigEndpoint) => {
                // @ts-ignore
                endpoint = openIdConfigEndpoint;
                return DEFAULT_OPENID_CONFIG_RESPONSE;
            });

            await authority.resolveEndpointsAsync();
            expect(endpoint).toBe(`${authorityUrl}.well-known/openid-configuration`);
        })
    });
});
