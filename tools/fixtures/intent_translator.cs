class IntentSink { public void Move(int value) { } public void Jump() { } }

class IntentTranslator
{
    private readonly IntentSink _sink = new IntentSink();
    public void OnMove(int value) => _sink.Move(value);
    public void OnJump() => _sink.Jump();
}
