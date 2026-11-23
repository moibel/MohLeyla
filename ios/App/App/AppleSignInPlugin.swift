import Capacitor
import AuthenticationServices

/// Sign in with Apple, using the system's own sheet (AuthenticationServices). The web side sends the SHA-256 of a random nonce;
/// the signed token Apple returns contains that hash, and Supabase checks it against the raw nonce.
@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)]
    private var pending: CAPPluginCall?

    @objc func authorize(_ call: CAPPluginCall) {
        guard pending == nil else { call.reject("Sign in with Apple is already open", "busy"); return }
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        if let nonce = call.getString("nonce"), !nonce.isEmpty { request.nonce = nonce }
        pending = call
        DispatchQueue.main.async {
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = pending else { return }
        pending = nil
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken, let token = String(data: tokenData, encoding: .utf8) else {
            call.reject("Apple did not return a sign-in token", "failed"); return
        }
        let code = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        call.resolve([
            "identityToken": token,
            "authorizationCode": code ?? NSNull(),
            "user": credential.user,
            "email": credential.email ?? NSNull(),
            "givenName": credential.fullName?.givenName ?? NSNull(),
            "familyName": credential.fullName?.familyName ?? NSNull(),
        ])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = pending else { return }
        pending = nil
        if let e = error as? ASAuthorizationError, e.code == .canceled { call.reject("Cancelled", "canceled") } else { call.reject("Sign in with Apple failed", "failed") }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
