plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release credentials come from the build environment and are never versioned.
val releaseStore = providers.environmentVariable("CAF_KEYSTORE_PATH").orNull
val releaseStorePassword = providers.environmentVariable("CAF_KEYSTORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("CAF_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("CAF_KEY_PASSWORD").orNull
val releaseApplicationId = providers.environmentVariable("CAF_ANDROID_APPLICATION_ID").orNull
val signingReady = listOf(releaseStore, releaseStorePassword, releaseKeyAlias, releaseKeyPassword).all { !it.isNullOrBlank() }

android {
    namespace = "com.example.client_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = releaseApplicationId ?: "com.example.client_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (signingReady) {
                storeFile = file(releaseStore!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

flutter {
    source = "../.."
}

// Never produce a store artifact with a debug key or template application ID.
gradle.taskGraph.whenReady {
    if (allTasks.any { it.name.endsWith("Release") || it.name.contains("ReleaseBundle") }) {
        if (!signingReady || releaseApplicationId.isNullOrBlank() || releaseApplicationId.startsWith("com.example.")) {
            throw GradleException("CAF release builds require CAF_ANDROID_APPLICATION_ID and CAF_KEYSTORE_PATH, CAF_KEYSTORE_PASSWORD, CAF_KEY_ALIAS, CAF_KEY_PASSWORD.")
        }
    }
}
