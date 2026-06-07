fn main() {
    tauri_build::build();

    #[cfg(target_os = "macos")]
    {
        // Embed Info.plist into the dev binary so macOS shows the microphone
        // permission prompt and surfaces NSMicrophoneUsageDescription.
        println!("cargo:rustc-link-arg=-Wl,-sectcreate,__TEXT,__info_plist,Info.plist");
        println!("cargo:rerun-if-changed=Info.plist");
        println!("cargo:rerun-if-changed=entitlements.plist");
    }
}
