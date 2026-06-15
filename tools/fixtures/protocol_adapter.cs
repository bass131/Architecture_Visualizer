class FrameReader { public int Read() => 0; }
class DispatchTable { public void Dispatch(int frame) { } }
class TransportBase { public virtual void OnReceive() { } }

class ProtocolAdapter : TransportBase
{
    private readonly FrameReader _reader = new FrameReader();
    private readonly DispatchTable _handlers = new DispatchTable();
    private int _received;
    private int _dispatched;

    public override void OnReceive()
    {
        _received = _received + 1;
        int frame = _reader.Read();
        _handlers.Dispatch(frame);
        _dispatched = _dispatched + 1;
    }
    public void Reset()
    {
        _received = 0;
        _dispatched = 0;
    }
}
