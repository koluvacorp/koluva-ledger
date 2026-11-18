package com.koluva.ledger;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LedgerNative.class);
        super.onCreate(savedInstanceState);
    }
}
