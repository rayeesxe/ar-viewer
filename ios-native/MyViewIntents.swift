import AppIntents
import UIKit

// Objects Siri can show. Spoken names must match these titles.
enum ViewObject: String, AppEnum {
  case helmet, boombox, camera, lantern, bottle, avocado, kebab, shoe, corset, truck, rocket, astronaut, robot, fox, horse, fish, parrot, flamingo, duck

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Object"
  static let caseDisplayRepresentations: [ViewObject: DisplayRepresentation] = [
    .helmet: "helmet",
    .boombox: "boombox",
    .camera: "camera",
    .lantern: "lantern",
    .bottle: "water bottle",
    .avocado: "avocado",
    .kebab: "kebab",
    .shoe: "sneaker",
    .corset: "corset",
    .truck: "truck",
    .rocket: "rocket",
    .astronaut: "astronaut",
    .robot: "robot",
    .fox: "fox",
    .horse: "horse",
    .fish: "fish",
    .parrot: "parrot",
    .flamingo: "flamingo",
    .duck: "duck"
  ]
}

// "Hey Siri, show me an avocado in My View"
struct ShowObjectIntent: AppIntent {
  static let title: LocalizedStringResource = "Show object"
  static let description = IntentDescription("Opens My View and places the object in your room.")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Object")
  var object: ViewObject

  @MainActor
  func perform() async throws -> some IntentResult {
    UserDefaults.standard.set(object.rawValue, forKey: "myview.pendingObject")
    if let url = URL(string: "myview://show/\(object.rawValue)") {
      await UIApplication.shared.open(url)
    }
    return .result()
  }
}

struct MyViewShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: ShowObjectIntent(),
      phrases: [
        "Show \(\.$object) in \(.applicationName)",
        "Show me \(\.$object) in \(.applicationName)",
        "Show me a \(\.$object) in \(.applicationName)",
        "Show me an \(\.$object) in \(.applicationName)",
        "Place \(\.$object) in \(.applicationName)",
        "Put \(\.$object) in \(.applicationName)"
      ],
      shortTitle: "Show object",
      systemImageName: "cube"
    )
  }
}
