import { splitTypeSignature } from "#utils/type_signature";
import { describe, it } from "node:test";
import assert from "node:assert";

describe("splitTypeSignature", () => {
  it("basic", () => {
    const input =
      "{ init : model, view : model -> Html.Html msg, update : msg -> model -> model } -> Platform.Program {} model msg";
    const result = [
      "{ init : model",
      ", view : model -> Html.Html msg",
      ", update : msg -> model -> model",
      "}",
      "-> Platform.Program {} model msg",
    ];

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it("type2", () => {
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

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it.skip("nested record", () => {
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

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it("record", () => {
    const input = "{ title : String, body : Array (Html msg) }";
    const result = ["{ title : String", ", body : Array (Html msg)", "}"];

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it("decoder lazy", () => {
    const input = "({} -> Decoder a) -> Decoder a";
    const result = ["({} -> Decoder a)", "-> Decoder a"];

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it("task sleep", () => {
    const input = "Float -> Task x {}";
    const result = ["Float", "-> Task x {}"];

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it("decoder Object Primitives", () => {
    const input = "Array String -> Decoder a -> Decoder a ";
    const result = ["Array String", "-> Decoder a", "-> Decoder a"];

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it("decoder keyValuePairs", () => {
    const input = "Decoder a -> Decoder (Array { key : String, value : a })";
    const result = [
      "Decoder a",
      "-> Decoder (Array { key : String, value : a })",
    ];

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it("comparable", () => {
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

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it("record as second/third param", () => {
    const input =
      "Permission -> String -> { recursive : Bool, key : String } -> Task AccessError {}";
    const result = [
      "Permission",
      "-> String",
      "-> { recursive : Bool, key : String }",
      "-> Task AccessError {}",
    ];

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it("lambda as second/third param", () => {
    const input =
      "state -> (state -> Parser c x ( Step state a)) -> Parser c x a";
    const result = [
      "state",
      "-> (state -> Parser c x ( Step state a))",
      "-> Parser c x a",
    ];

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it("decoder map8", () => {
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

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });

  it("token with '_' should not skip formatting", () => {
    const input =
      "{ host : String, port_ : Int, env : Environment, model : appModel}";
    const result = [
      "{ host : String",
      ", port_ : Int",
      ", env : Environment",
      ", model : appModel",
      "}",
    ];

    assert.deepStrictEqual(splitTypeSignature(input), result);
  });
});
