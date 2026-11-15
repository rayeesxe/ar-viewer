import AppIntents
import UIKit

// Opens My View with a deep link that the app understands.
@MainActor
private func openMyView(_ path: String) async {
  let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
  let encoded = path.addingPercentEncoding(withAllowedCharacters: allowed) ?? path
  if let url = URL(string: "myview://" + encoded.replacingOccurrences(of: "%2F", with: "/")) {
    try? await Task.sleep(nanoseconds: 300_000_000)
    await UIApplication.shared.open(url)
  }
}

// ---------- 3D objects ----------
enum ViewObject: String, AppEnum {
  case avocado, kebab, pumpkin, bottle, lantern, barrel, buoy, helmet, boombox, camera, engine, gearbox, saw, iondrive, shoe, corset, truck, car, buggy, rocket, ship, astronaut, armstrong, soldier, girl, man, robot, mannequin, dancer, alien, fox, horse, fish, octopus, parrot, flamingo, stork, duck, dice, bowlingball, bowlingpin, house, village, city
  case pyramidsOfGiza = "pyramids of Giza"
  case sphinx = "Sphinx"
  case eiffelTower = "Eiffel Tower"
  case tajMahal = "Taj Mahal"
  case statueOfLiberty = "Statue of Liberty"
  case colosseum = "Colosseum"
  case bigBen = "Big Ben"
  case towerBridge = "Tower Bridge"
  case stonehenge = "Stonehenge"
  case burjKhalifa = "Burj Khalifa"
  case sydneyOperaHouse = "Sydney Opera House"
  case leaningTowerOfPisa = "Leaning Tower of Pisa"
  case christTheRedeemer = "Christ the Redeemer"
  case greatWall = "Great Wall of China"
  case dinosaur = "dinosaur"
  case tRex = "T rex"
  case elephant = "elephant"
  case lion = "lion"
  case tiger = "tiger"
  case giraffe = "giraffe"
  case shark = "shark"
  case whale = "whale"
  case dolphin = "dolphin"
  case panda = "panda"
  case penguin = "penguin"
  case eagle = "eagle"
  case dog = "dog"
  case cat = "cat"
  case earth = "Earth"
  case moon = "Moon"
  case mars = "Mars"
  case saturn = "Saturn"
  case solarSystem = "solar system"
  case humanHeart = "human heart"
  case humanBrain = "human brain"
  case skeleton = "skeleton"
  case sofa = "sofa"
  case chair = "chair"
  case guitar = "guitar"
  case piano = "piano"
  case bicycle = "bicycle"
  case motorbike = "motorbike"
  case sportsCar = "sports car"
  case airplane = "aeroplane"
  case helicopter = "helicopter"
  case tree = "tree"
  case burger = "burger"
  case pizza = "pizza"

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Object"
  static let caseDisplayRepresentations: [ViewObject: DisplayRepresentation] = [
    .avocado: "avocado",
    .kebab: "shish kebab",
    .pumpkin: "pumpkin",
    .bottle: "water bottle",
    .lantern: "lantern",
    .barrel: "barrel",
    .buoy: "buoy",
    .helmet: "helmet",
    .boombox: "boombox",
    .camera: "camera",
    .engine: "engine",
    .gearbox: "gearbox",
    .saw: "power saw",
    .iondrive: "ion drive",
    .shoe: "sneaker",
    .corset: "corset",
    .truck: "truck",
    .car: "toy car",
    .buggy: "buggy",
    .rocket: "rocket",
    .ship: "pirate ship",
    .astronaut: "astronaut",
    .armstrong: "Neil Armstrong",
    .soldier: "soldier",
    .girl: "girl",
    .man: "walking man",
    .robot: "robot",
    .mannequin: "mannequin",
    .dancer: "robot dancer",
    .alien: "alien",
    .fox: "fox",
    .horse: "horse",
    .fish: "fish",
    .octopus: "octopus",
    .parrot: "parrot",
    .flamingo: "flamingo",
    .stork: "stork",
    .duck: "duck",
    .dice: "dice",
    .bowlingball: "bowling ball",
    .bowlingpin: "bowling pin",
    .house: "house",
    .village: "village",
    .city: "city",
    .pyramidsOfGiza: "pyramids of Giza",
    .sphinx: "Sphinx",
    .eiffelTower: "Eiffel Tower",
    .tajMahal: "Taj Mahal",
    .statueOfLiberty: "Statue of Liberty",
    .colosseum: "Colosseum",
    .bigBen: "Big Ben",
    .towerBridge: "Tower Bridge",
    .stonehenge: "Stonehenge",
    .burjKhalifa: "Burj Khalifa",
    .sydneyOperaHouse: "Sydney Opera House",
    .leaningTowerOfPisa: "Leaning Tower of Pisa",
    .christTheRedeemer: "Christ the Redeemer",
    .greatWall: "Great Wall of China",
    .dinosaur: "dinosaur",
    .tRex: "T rex",
    .elephant: "elephant",
    .lion: "lion",
    .tiger: "tiger",
    .giraffe: "giraffe",
    .shark: "shark",
    .whale: "whale",
    .dolphin: "dolphin",
    .panda: "panda",
    .penguin: "penguin",
    .eagle: "eagle",
    .dog: "dog",
    .cat: "cat",
    .earth: "Earth",
    .moon: "Moon",
    .mars: "Mars",
    .saturn: "Saturn",
    .solarSystem: "solar system",
    .humanHeart: "human heart",
    .humanBrain: "human brain",
    .skeleton: "skeleton",
    .sofa: "sofa",
    .chair: "chair",
    .guitar: "guitar",
    .piano: "piano",
    .bicycle: "bicycle",
    .motorbike: "motorbike",
    .sportsCar: "sports car",
    .airplane: "aeroplane",
    .helicopter: "helicopter",
    .tree: "tree",
    .burger: "burger",
    .pizza: "pizza"
  ]
}

// "Hey Siri, show me an avocado in My View"
struct ShowObjectIntent: AppIntent {
  static let title: LocalizedStringResource = "Show object"
  static let description = IntentDescription("Opens My View, finds the object in 3D and places it in front of you.")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Object")
  var object: ViewObject

  @MainActor
  func perform() async throws -> some IntentResult {
    await openMyView("show/" + object.rawValue)
    return .result()
  }
}

// ---------- YouTube how-to ----------
enum Dish: String, AppEnum {
  case sandwich = "sandwich"
  case pancakes = "pancakes"
  case pasta = "pasta"
  case omelette = "omelette"
  case scrambledEggs = "scrambled eggs"
  case coffee = "coffee"
  case tea = "tea"
  case smoothie = "smoothie"
  case salad = "salad"
  case pizza = "pizza"
  case burger = "burger"
  case cake = "cake"
  case cookies = "cookies"
  case curry = "curry"
  case biryani = "biryani"
  case friedrice = "fried rice"
  case soup = "soup"
  case kebab = "kebab"
  case toast = "toast"
  case guacamole = "guacamole"

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Dish"
  static let caseDisplayRepresentations: [Dish: DisplayRepresentation] = [
    .sandwich: "sandwich",
    .pancakes: "pancakes",
    .pasta: "pasta",
    .omelette: "omelette",
    .scrambledEggs: "scrambled eggs",
    .coffee: "coffee",
    .tea: "tea",
    .smoothie: "smoothie",
    .salad: "salad",
    .pizza: "pizza",
    .burger: "burger",
    .cake: "cake",
    .cookies: "cookies",
    .curry: "curry",
    .biryani: "biryani",
    .friedrice: "fried rice",
    .soup: "soup",
    .kebab: "kebab",
    .toast: "toast",
    .guacamole: "guacamole"
  ]
}

enum Skill: String, AppEnum {
  case tieATie = "tie a tie"
  case foldAShirt = "fold a shirt"
  case changeATyre = "change a tyre"
  case doPushUps = "do push ups"
  case meditate = "meditate"
  case juggle = "juggle"
  case drawACat = "draw a cat"
  case solveARubiksCube = "solve a Rubik's cube"
  case makeAPaperPlane = "make a paper plane"
  case plantSeeds = "plant seeds"

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Skill"
  static let caseDisplayRepresentations: [Skill: DisplayRepresentation] = [
    .tieATie: "tie a tie",
    .foldAShirt: "fold a shirt",
    .changeATyre: "change a tyre",
    .doPushUps: "do push ups",
    .meditate: "meditate",
    .juggle: "juggle",
    .drawACat: "draw a cat",
    .solveARubiksCube: "solve a Rubik's cube",
    .makeAPaperPlane: "make a paper plane",
    .plantSeeds: "plant seeds"
  ]
}

// "Hey Siri, show me how to make a sandwich in My View"
struct HowToMakeIntent: AppIntent {
  static let title: LocalizedStringResource = "Show how to make"
  static let description = IntentDescription("Plays a how-to video over your camera.")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Dish")
  var dish: Dish

  @MainActor
  func perform() async throws -> some IntentResult {
    await openMyView("watch/how to make " + dish.rawValue)
    return .result()
  }
}

// "Hey Siri, show me how to tie a tie in My View"
struct HowToDoIntent: AppIntent {
  static let title: LocalizedStringResource = "Show how to"
  static let description = IntentDescription("Plays a how-to video over your camera.")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Skill")
  var skill: Skill

  @MainActor
  func perform() async throws -> some IntentResult {
    await openMyView("watch/how to " + skill.rawValue)
    return .result()
  }
}

// "Hey Siri, search My View" -> "What do you want to see?" -> anything at all
struct SearchIntent: AppIntent {
  static let title: LocalizedStringResource = "Search My View"
  static let description = IntentDescription("Shows a 3D object if My View has it, otherwise finds a YouTube video.")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Request", requestValueDialog: IntentDialog("What do you want to see?"))
  var text: String

  @MainActor
  func perform() async throws -> some IntentResult {
    await openMyView("search/" + text)
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
        "Show me the \(\.$object) in \(.applicationName)",
        "Place \(\.$object) in \(.applicationName)",
        "Put a \(\.$object) in \(.applicationName)"
      ],
      shortTitle: "Show object",
      systemImageName: "cube"
    )
    AppShortcut(
      intent: HowToMakeIntent(),
      phrases: [
        "Show me how to make \(\.$dish) in \(.applicationName)",
        "Show me how to make a \(\.$dish) in \(.applicationName)",
        "Show me how to make an \(\.$dish) in \(.applicationName)",
        "How do I make \(\.$dish) in \(.applicationName)",
        "How do I make a \(\.$dish) in \(.applicationName)",
        "Teach me to make \(\.$dish) in \(.applicationName)"
      ],
      shortTitle: "How to make",
      systemImageName: "fork.knife"
    )
    AppShortcut(
      intent: HowToDoIntent(),
      phrases: [
        "Show me how to \(\.$skill) in \(.applicationName)",
        "How do I \(\.$skill) in \(.applicationName)",
        "Teach me to \(\.$skill) in \(.applicationName)"
      ],
      shortTitle: "How to",
      systemImageName: "play.rectangle"
    )
    AppShortcut(
      intent: SearchIntent(),
      phrases: [
        "Search \(.applicationName)",
        "Search in \(.applicationName)",
        "Show something in \(.applicationName)",
        "Watch a video in \(.applicationName)",
        "Find a video in \(.applicationName)"
      ],
      shortTitle: "Search",
      systemImageName: "magnifyingglass"
    )
  }
}
