import { splitTypeSignature } from "#utils/type_signature";

describe("splitTypeSignature", () => {
  test("basic", () => {
    const input =
      "{ init : model, view : model -> Html.Html msg, update : msg -> model -> model } -> Platform.Program {} model msg";
    const result = [
      "{ init : model",
      ", view : model -> Html.Html msg",
      ", update : msg -> model -> model",
      "}",
      "-> Platform.Program {} model msg",
    ];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });

  test("type2", () => {
    const input =
      "{ init : flags -> Url -> Key -> { model : model, command : Cmd msg }, view : model -> Document msg, update : msg -> model -> { model : model, command : Cmd msg }, subscriptions : model -> Sub msg, onUrlRequest : UrlRequest -> msg, onUrlChange : Url -> msg } -> Program flags model msg";
    const result = [
      "{ init : flags -> Url -> Key -> { model : model, command : Cmd msg }",
      ", view : model -> Document msg",
      ", update : msg -> model -> { model : model, command : Cmd msg }",
      ", subscriptions : model -> Sub msg",
      ", onUrlRequest : UrlRequest -> msg",
      ", onUrlChange : Url -> msg",
      "}",
      "-> Program flags model msg",
    ];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });

  xtest("nested record", () => {
    const input = "";
    const result = [
      "{ scene :",
      "    { width : Float",
      "    , height : Float",
      "    }",
      ", viewport :",
      "    { x : Float",
      "    , y : Float",
      "    , width : Float",
      "    , height : Float",
      "    }",
      "}",
    ];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });

  test("record", () => {
    const input = "{ title : String, body : Array (Html msg) }";
    const result = ["{ title : String", ", body : Array (Html msg)", "}"];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });

  test("decoder lazy", () => {
    const input = "({} -> Decoder a) -> Decoder a";
    const result = ["({} -> Decoder a)", "-> Decoder a"];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });

  xtest("task sleep", () => {
    const input = "Float -> Task x {}";
    const result = ["Float -> Task x {}"];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });

  test("decoder Object Primitives", () => {
    const input = "Array String -> Decoder a -> Decoder a ";
    const result = ["Array String", "-> Decoder a", "-> Decoder a"];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });

  test("decoder keyValuePairs", () => {
    const input = "Decoder a -> Decoder (Array { key : String, value : a })";
    const result = [
      "Decoder a",
      "-> Decoder (Array { key : String, value : a })",
    ];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });

  test("comparable", () => {
    const input =
      "(comparable -> a -> result -> result) -> (comparable -> a -> b -> result -> result) -> (comparable -> b -> result -> result) -> Dict comparable a -> Dict comparable b -> result -> result";
    const result = [
      "(comparable -> a -> result -> result)",
      "-> (comparable -> a -> b -> result -> result)",
      "-> (comparable -> b -> result -> result)",
      "-> Dict comparable a",
      "-> Dict comparable b",
      "-> result",
      "-> result",
    ];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });

  test("record as second/third param", () => {
    const input =
      "Permission -> String -> { recursive : Bool, key : String } -> Task AccessError {}";
    const result = [
      "Permission",
      "-> String",
      "-> { recursive : Bool, key : String }",
      "-> Task AccessError {}",
    ];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });

  test("lambda as second/third param", () => {
    const input =
      "state -> (state -> Parser c x ( Step state a)) -> Parser c x a";
    const result = [
      "state",
      "-> (state -> Parser c x ( Step state a))",
      "-> Parser c x a",
    ];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });

  test("decoder map8", () => {
    const input =
      "(a -> b -> c -> d -> e -> f -> g -> h -> value) -> Decoder a -> Decoder b -> Decoder c -> Decoder d -> Decoder e -> Decoder f -> Decoder g -> Decoder h -> Decoder value";
    const result = [
      "(a -> b -> c -> d -> e -> f -> g -> h -> value)",
      "-> Decoder a",
      "-> Decoder b",
      "-> Decoder c",
      "-> Decoder d",
      "-> Decoder e",
      "-> Decoder f",
      "-> Decoder g",
      "-> Decoder h",
      "-> Decoder value",
    ];

    expect(splitTypeSignature(input)).toStrictEqual(result);
  });
});
